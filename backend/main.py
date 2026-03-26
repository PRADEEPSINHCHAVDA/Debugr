import io
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

import chromadb
import pandas as pd
import pdfplumber
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

app = FastAPI(title="Debugr AI — RAG DevOps Assistant")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── Persistence setup ─────────────────────────────────────────────────────────
DATA_DIR = Path("./data")
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "sessions.db"
CHROMA_PATH = str(DATA_DIR / "chroma")

chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)
embedder = SentenceTransformer("all-MiniLM-L6-v2")
sessions: Dict[str, Dict[str, Any]] = {}

# ── SQLite helpers ────────────────────────────────────────────────────────────
def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            session_id    TEXT PRIMARY KEY,
            filename      TEXT NOT NULL,
            file_type     TEXT NOT NULL,
            chunks        INTEGER NOT NULL,
            auto_insights TEXT NOT NULL,
            created_at    TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def save_session_db(session_id: str, filename: str, file_type: str, chunks: int, auto_insights: dict):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT OR REPLACE INTO sessions VALUES (?, ?, ?, ?, ?, ?)",
        (session_id, filename, file_type, chunks, json.dumps(auto_insights), datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()


def delete_session_db(session_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM sessions WHERE session_id = ?", (session_id,))
    conn.commit()
    conn.close()


def load_sessions_db() -> Dict[str, Dict[str, Any]]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT * FROM sessions ORDER BY created_at DESC").fetchall()
    conn.close()
    result: Dict[str, Dict[str, Any]] = {}
    for sid, filename, file_type, chunks, insights_json, created_at in rows:
        try:
            collection = chroma_client.get_collection(name=sid)
            result[sid] = {
                "collection": collection,
                "history": [],
                "filename": filename,
                "file_type": file_type,
                "chunks": chunks,
                "auto_insights": json.loads(insights_json),
                "created_at": created_at,
            }
        except Exception:
            delete_session_db(sid)  # ChromaDB collection gone — clean up metadata
    return result


@app.on_event("startup")
async def startup_event():
    init_db()
    sessions.update(load_sessions_db())


# ── Persona system prompts ────────────────────────────────────────────────────
PERSONA_PROMPTS: Dict[str, str] = {
    "sre": """You are an expert SRE AI assistant analyzing logs, CSVs, and technical documents.

Structure every response with this exact 4-phase format:

## 🔍 Phase 1: Evidence Gathered
Specific findings with exact references (line numbers, values, timestamps).

## 💡 Phase 2: Hypotheses
Top 2-3 ranked hypotheses about what is wrong.

## ✅ Phase 3: Root Cause
Confirmed root cause based on evidence. Be definitive.

## 🛠️ Phase 4: Recommendations
Concrete ordered steps with commands where applicable.

Be precise, technical, cite evidence from the document.""",

    "security": """You are an expert Security Engineer AI assistant.

Structure every response with this exact 4-phase format:

## 🔍 Phase 1: Evidence Gathered
Security findings: auth events, access anomalies, suspicious patterns, exposed data.

## 💡 Phase 2: Threat Hypotheses
Top threats ranked: CRITICAL / HIGH / MEDIUM / LOW.

## ✅ Phase 3: Confirmed Issues
Confirmed vulnerabilities, misconfigs, or breaches. CVE references if applicable.

## 🛠️ Phase 4: Mitigations
Prioritized steps with urgency: Immediate / 24h / 1 week.

Focus on: unauthorized access, privilege escalation, data exfiltration, injection, exposed secrets.""",

    "data": """You are an expert Data Analyst AI assistant.

Structure every response with this exact 4-phase format:

## 🔍 Phase 1: Data Profile
Shape, columns, data types, value ranges, missing values, duplicates.

## 💡 Phase 2: Anomaly Hypotheses
Hypotheses about data quality issues, outliers, or unusual distributions.

## ✅ Phase 3: Confirmed Issues
Confirmed data problems with specific column/row references and values.

## 🛠️ Phase 4: Recommendations
Cleaning steps, validation rules, transformation approaches, further analysis.

Focus on: outliers, missing values, type mismatches, duplicate rows, statistical anomalies.""",
}


# ── Output Redaction ──────────────────────────────────────────────────────────
REDACT_PATTERNS = [
    (re.compile(r'sk-[a-zA-Z0-9]{20,}', re.IGNORECASE), '[REDACTED_API_KEY]'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[REDACTED_AWS_KEY]'),
    (re.compile(r'eyJ[a-zA-Z0-9._-]{20,}'), '[REDACTED_JWT]'),
    (re.compile(r'(password\s*[=:]\s*)\S+', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(secret\s*[=:]\s*)\S+', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(token\s*[=:]\s*)\S+', re.IGNORECASE), r'\1[REDACTED]'),
    (re.compile(r'(api[_-]?key\s*[=:]\s*)\S+', re.IGNORECASE), r'\1[REDACTED]'),
]


def redact_output(text: str) -> str:
    for pattern, replacement in REDACT_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


# ── Context Compaction ────────────────────────────────────────────────────────
def compact_history(history: List[Dict], groq_client: Groq, file_type: str) -> List[Dict]:
    """When history exceeds 14 messages, summarize the oldest to preserve context."""
    if len(history) <= 14:
        return history
    to_compress = history[:-6]
    recent = history[-6:]
    compress_prompt = (
        f"Summarize these {file_type} analysis conversation exchanges into 3-5 bullet points "
        "capturing key findings and conclusions. Be very concise.\n\n"
        + "\n".join(f"{m['role'].upper()}: {m['content'][:300]}" for m in to_compress)
    )
    try:
        resp = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": compress_prompt}],
            temperature=0.1, max_tokens=300, stream=False,
        )
        summary = resp.choices[0].message.content.strip()
        return [{"role": "assistant", "content": f"[Conversation summary]\n{summary}"}] + recent
    except Exception:
        return history[-10:]  # Fallback: keep last 10


# ── Parsers ───────────────────────────────────────────────────────────────────
def parse_pdf(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        return "\n".join(page.extract_text() or "" for page in pdf.pages)


def parse_csv(content: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(content))


def csv_to_structured_text(df: pd.DataFrame) -> str:
    return "\n".join([
        f"CSV rows: {len(df)}", f"CSV columns: {len(df.columns)}",
        f"Column names: {', '.join(df.columns.astype(str).tolist())}",
        "", "Row data:", df.to_string(index=False),
    ])


def parse_text(content: bytes) -> str:
    return content.decode("utf-8", errors="ignore")


def chunk_text_by_lines(text: str, chunk_words: int = 500, overlap_words: int = 50) -> List[str]:
    lines = [l for l in text.splitlines() if l.strip()]
    if not lines:
        return []
    chunks: List[str] = []
    cur: List[str] = []
    cw = 0
    for line in lines:
        lw = len(line.split())
        if cur and cw + lw > chunk_words:
            chunks.append("\n".join(cur))
            ov: List[str] = []
            oc = 0
            for el in reversed(cur):
                ov.insert(0, el)
                oc += len(el.split())
                if oc >= overlap_words:
                    break
            cur = ov
            cw = sum(len(x.split()) for x in cur)
        cur.append(line)
        cw += lw
    if cur:
        chunks.append("\n".join(cur))
    return chunks


def count_pattern_lines(text: str, pattern: str) -> int:
    rx = re.compile(pattern, re.IGNORECASE)
    return sum(1 for l in text.splitlines() if rx.search(l))


def build_text_insights(text: str) -> Dict[str, Any]:
    critical = count_pattern_lines(text, r"\b(critical|fatal|panic|segfault|oom|out of memory|kernel panic)\b")
    errors   = count_pattern_lines(text, r"\b(error|exception|traceback|failed|failure|denied|refused|crash)\b")
    warnings = count_pattern_lines(text, r"\b(warn|warning|deprecated|retry|timeout|throttl)\b")
    memory   = count_pattern_lines(text, r"\b(oom|out of memory|memory leak|memory pressure|heap)\b")
    cpu      = count_pattern_lines(text, r"\b(cpu|high load|load average|throttl)\b")
    findings = []
    if critical: findings.append(f"{critical} critical/fatal patterns detected.")
    if errors:   findings.append(f"{errors} error/exception patterns detected.")
    if warnings: findings.append(f"{warnings} warning/timeout patterns detected.")
    if memory:   findings.append(f"{memory} memory-related indicators detected.")
    if cpu:      findings.append(f"{cpu} CPU/load indicators detected.")
    if not findings: findings.append("No critical patterns detected in quick scan.")
    return {
        "summary": f"{critical} critical, {errors} errors, {warnings} warnings, {memory} memory, {cpu} CPU signals.",
        "findings": findings,
        "metrics": {"critical": critical, "errors": errors, "warnings": warnings, "memory_signals": memory, "cpu_signals": cpu},
    }


def build_csv_insights(df: pd.DataFrame) -> Dict[str, Any]:
    missing = int(df.isna().sum().sum())
    outliers = 0
    for col in df.select_dtypes(include=["number"]).columns:
        s = df[col].dropna()
        if len(s) >= 4:
            std = s.std()
            if std and std > 0:
                outliers += int((((s - s.mean()) / std).abs() > 3).sum())
    return {
        "summary": f"{missing} missing values, {outliers} outliers across {len(df.columns)} cols / {len(df)} rows.",
        "findings": [f"Rows: {len(df)} | Columns: {len(df.columns)}", f"Missing: {missing}", f"Outliers (z>3): {outliers}"],
        "metrics": {"rows": len(df), "columns": len(df.columns), "missing_values": missing, "potential_outliers": outliers},
    }


def detect_auto_insights(file_type: str, text: str, df: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    if file_type == "CSV" and df is not None:
        return build_csv_insights(df)
    return build_text_insights(text)


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/sessions")
async def list_sessions():
    return [
        {
            "session_id": sid,
            "filename": s["filename"],
            "file_type": s["file_type"],
            "chunks": s.get("chunks", 0),
            "created_at": s.get("created_at", ""),
            "auto_insights": s.get("auto_insights", {}),
        }
        for sid, s in sorted(sessions.items(), key=lambda x: x[1].get("created_at", ""), reverse=True)
    ]


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(400, "Filename missing.")
    filename = file.filename
    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content = await file.read()
    df: Optional[pd.DataFrame] = None

    if ext == "pdf":
        text, file_type = parse_pdf(content), "PDF"
    elif ext == "csv":
        df = parse_csv(content)
        text, file_type = csv_to_structured_text(df), "CSV"
    elif ext in {"log", "txt", "env"}:
        text, file_type = parse_text(content), "LOG"
    else:
        raise HTTPException(400, "Unsupported file type. Use PDF, CSV, LOG, TXT, or ENV.")

    if not text.strip():
        raise HTTPException(400, "No text content could be extracted.")
    chunks = chunk_text_by_lines(text)
    if not chunks:
        raise HTTPException(400, "Unable to create chunks from file.")

    session_id = str(uuid.uuid4())
    collection = chroma_client.create_collection(name=session_id)
    embeddings = embedder.encode(chunks, convert_to_numpy=True).tolist()
    collection.add(
        documents=chunks, embeddings=embeddings,
        ids=[f"{session_id}-{i}" for i in range(len(chunks))],
        metadatas=[{"filename": filename, "file_type": file_type}] * len(chunks),
    )
    insights = detect_auto_insights(file_type, text, df)
    created_at = datetime.now().isoformat()
    sessions[session_id] = {
        "collection": collection, "history": [],
        "filename": filename, "file_type": file_type,
        "chunks": len(chunks), "auto_insights": insights,
        "created_at": created_at,
    }
    save_session_db(session_id, filename, file_type, len(chunks), insights)
    return {
        "session_id": session_id, "filename": filename,
        "chunks": len(chunks), "file_type": file_type,
        "auto_insights": insights, "created_at": created_at,
    }


class QueryRequest(BaseModel):
    session_id: str
    query: str
    persona: str = "sre"


@app.post("/query")
async def query_document(request: QueryRequest):
    state = sessions.get(request.session_id)
    if state is None:
        raise HTTPException(404, "Session not found. Upload a file first.")
    collection = state["collection"]
    history = state["history"]
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(500, "GROQ_API_KEY not set.")

    q_emb = embedder.encode([request.query], convert_to_numpy=True).tolist()[0]
    n = max(1, min(5, collection.count()))
    results = collection.query(query_embeddings=[q_emb], n_results=n)
    chunks = results.get("documents", [[]])[0] or ["No relevant context found."]
    context = "\n\n---\n\n".join(chunks)

    persona = request.persona if request.persona in PERSONA_PROMPTS else "sre"
    system_prompt = PERSONA_PROMPTS[persona]
    user_prompt = f"Question: {request.query}\n\nDocument context:\n{context}\n\nProvide a focused analysis."

    groq_client = Groq(api_key=api_key)

    # Compact history before building messages
    compacted = compact_history(history, groq_client, state["file_type"])
    state["history"] = compacted

    def event_stream():
        msgs = [{"role": "system", "content": system_prompt}]
        if compacted:
            msgs.extend(compacted[-8:])
        msgs.append({"role": "user", "content": user_prompt})

        output = ""
        stream = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile", messages=msgs,
            temperature=0.1, max_tokens=2048, stream=True,
        )
        for part in stream:
            tok = part.choices[0].delta.content if part.choices else None
            if tok:
                tok = redact_output(tok)
                output += tok
                yield f"data: {json.dumps({'content': tok})}\n\n"

        history.append({"role": "user", "content": request.query})
        history.append({"role": "assistant", "content": output.strip()})

        # Generate follow-up suggestions
        try:
            fp = (
                f"Based on this {state['file_type']} analysis:\n"
                f"Q: {request.query}\nA: {output[:400]}...\n\n"
                "Generate exactly 3 short follow-up questions. "
                "Return ONLY a JSON array of 3 strings. No other text."
            )
            fr = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": fp}],
                temperature=0.4, max_tokens=120, stream=False,
            )
            ft = fr.choices[0].message.content.strip()
            m = re.search(r'\[.*?\]', ft, re.DOTALL)
            followups = json.loads(m.group())[:3] if m else []
        except Exception:
            followups = []

        if followups:
            yield f"data: {json.dumps({'followups': followups})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    state = sessions.pop(session_id, None)
    if state:
        try:
            chroma_client.delete_collection(name=session_id)
        except Exception:
            pass
        delete_session_db(session_id)
    return {"status": "deleted"}


@app.get("/health")
async def health():
    return {"status": "ok", "sessions": len(sessions)}
