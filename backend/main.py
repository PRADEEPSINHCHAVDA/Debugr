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
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from groq import Groq
from openai import OpenAI
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


def init_cron_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS cron_jobs (
            id               TEXT PRIMARY KEY,
            session_id       TEXT NOT NULL,
            label            TEXT NOT NULL,
            query            TEXT NOT NULL,
            persona          TEXT NOT NULL DEFAULT 'sre',
            provider         TEXT NOT NULL DEFAULT 'groq',
            model            TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
            interval_minutes INTEGER NOT NULL DEFAULT 60,
            enabled          INTEGER NOT NULL DEFAULT 1,
            last_run         TEXT,
            last_result      TEXT,
            created_at       TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()


def load_cron_jobs_db() -> List[Dict]:
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT * FROM cron_jobs ORDER BY created_at DESC").fetchall()
    conn.close()
    cols = ["id","session_id","label","query","persona","provider","model",
            "interval_minutes","enabled","last_run","last_result","created_at"]
    return [dict(zip(cols, row)) for row in rows]


def update_cron_result(job_id: str, result: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "UPDATE cron_jobs SET last_run=?, last_result=? WHERE id=?",
        (datetime.now().isoformat(), result[:2000], job_id),
    )
    conn.commit()
    conn.close()


# ── Scheduler ─────────────────────────────────────────────────────────────────
scheduler = BackgroundScheduler(timezone="UTC")


def run_cron_job(job: Dict):
    state = sessions.get(job["session_id"])
    if not state:
        update_cron_result(job["id"], "Session not found — skipped.")
        return
    collection = state["collection"]
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        update_cron_result(job["id"], "GROQ_API_KEY not set — skipped.")
        return
    try:
        q_emb = embedder.encode([job["query"]], convert_to_numpy=True).tolist()[0]
        n = max(1, min(5, collection.count()))
        results = collection.query(query_embeddings=[q_emb], n_results=n)
        doc_chunks = results.get("documents", [[]])[0] or ["No relevant context."]
        context = "\n\n---\n\n".join(doc_chunks)
        persona = job.get("persona", "sre")
        system_prompt = PERSONA_PROMPTS.get(persona, PERSONA_PROMPTS["sre"])
        user_prompt = f"Scheduled scan query: {job['query']}\n\nDocument context:\n{context}\n\nProvide a focused analysis."
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_prompt}],
            temperature=0.1, max_tokens=1024, stream=False,
        )
        result = resp.choices[0].message.content.strip()
        result = redact_output(result)
    except Exception as e:
        result = f"Error during scheduled scan: {e}"
    update_cron_result(job["id"], result)


def schedule_job(job: Dict):
    scheduler.add_job(
        run_cron_job, "interval",
        minutes=int(job["interval_minutes"]),
        id=job["id"], replace_existing=True,
        kwargs={"job": job},
    )


@app.on_event("startup")
async def startup_event():
    init_db()
    init_cron_db()
    sessions.update(load_sessions_db())
    # Re-schedule all enabled cron jobs
    for job in load_cron_jobs_db():
        if job["enabled"]:
            schedule_job(job)
    scheduler.start()


@app.on_event("shutdown")
async def shutdown_event():
    scheduler.shutdown(wait=False)


# ── LLM Provider Presets ─────────────────────────────────────────────────────
PROVIDER_PRESETS: Dict[str, Dict[str, Any]] = {
    "groq": {
        "label": "Groq",
        "base_url": "https://api.groq.com/openai/v1",
        "env_key": "GROQ_API_KEY",
        "models": [
            {"id": "llama-3.3-70b-versatile", "label": "Llama 3.3 70B"},
            {"id": "llama-3.1-8b-instant",    "label": "Llama 3.1 8B (fast)"},
            {"id": "mixtral-8x7b-32768",       "label": "Mixtral 8x7B"},
            {"id": "gemma2-9b-it",             "label": "Gemma 2 9B"},
        ],
        "default_model": "llama-3.3-70b-versatile",
    },
    "openai": {
        "label": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "env_key": "OPENAI_API_KEY",
        "models": [
            {"id": "gpt-4o",       "label": "GPT-4o"},
            {"id": "gpt-4o-mini",  "label": "GPT-4o Mini"},
            {"id": "gpt-4-turbo",  "label": "GPT-4 Turbo"},
        ],
        "default_model": "gpt-4o-mini",
    },
    "together": {
        "label": "Together AI",
        "base_url": "https://api.together.xyz/v1",
        "env_key": "TOGETHER_API_KEY",
        "models": [
            {"id": "meta-llama/Llama-3-70b-chat-hf",  "label": "Llama 3 70B"},
            {"id": "mistralai/Mixtral-8x7B-Instruct-v0.1", "label": "Mixtral 8x7B"},
        ],
        "default_model": "meta-llama/Llama-3-70b-chat-hf",
    },
    "ollama": {
        "label": "Ollama (local)",
        "base_url": "http://localhost:11434/v1",
        "env_key": None,
        "models": [
            {"id": "llama3",   "label": "Llama 3"},
            {"id": "mistral",  "label": "Mistral"},
            {"id": "phi3",     "label": "Phi-3"},
        ],
        "default_model": "llama3",
    },
}

DEFAULT_PROVIDER = "groq"
DEFAULT_MODEL    = "llama-3.3-70b-versatile"


def get_openai_client(provider: str) -> OpenAI:
    preset = PROVIDER_PRESETS.get(provider, PROVIDER_PRESETS[DEFAULT_PROVIDER])
    env_key = preset["env_key"]
    api_key = os.getenv(env_key) if env_key else "ollama"
    if not api_key:
        raise HTTPException(500, f"{env_key} not set. Configure it to use {preset['label']}.")
    return OpenAI(api_key=api_key, base_url=preset["base_url"])


# ── Persona system prompts ────────────────────────────────────────────────────
CORE_PROMPT = """You are a Cloud & DevOps incident analysis engine. You are not a chatbot. You do not make conversation. You find facts, surface anomalies, and give engineers actionable output they can act on immediately.

DOMAINS YOU COVER:
- Incident response & postmortems (logs, traces, metrics)
- Infrastructure as Code (Terraform, Pulumi, CDK — drift, plan errors, state corruption)
- CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins, ArgoCD — build failures, deploy errors)
- Kubernetes & containers (pod crashes, OOMKills, evictions, misconfigs, RBAC)
- Cloud providers (AWS, GCP, Azure — service limits, IAM errors, quota exhaustion)
- Observability (Datadog, Grafana, Prometheus — alert fatigue, missing coverage, bad SLOs)
- Security & compliance (exposed secrets, misconfigured IAM, policy drift)
- Cost anomalies (spend spikes, orphaned resources, right-sizing opportunities)
- Database operations (RDS, Cloud SQL, Aurora — replication lag, failover, migrations)
- Networking (VPC misconfig, DNS failures, certificate expiry, load balancer errors)

INPUT TYPES YOU ACCEPT:
- Log files (.log, .txt) — application, system, audit logs
- Metrics exports (.csv, .json) — Datadog, Prometheus, CloudWatch
- IaC files (.tf, .yaml, .json) — Terraform plans, Helm charts, K8s manifests
- CI/CD output — pipeline logs, build errors, deploy diffs
- Cloud billing exports — AWS Cost Explorer CSV, GCP billing export
- PDFs — incident reports, architecture docs, postmortems
- Raw paste — terminal output, kubectl output, error messages, stack traces

BEFORE EVERY ANALYSIS:
1. Print the first line of each uploaded file verbatim
2. Confirm file count: "I have X files in context: [list names]"
3. If a file is unreadable, print PARSE FAILURE: [filename] and stop — never guess its contents
4. If no files are uploaded, say NO FILES DETECTED and ask the user to attach them

RULES:
- Never say "it appears" or "it seems" — state facts or say UNKNOWN
- Never give generic recommendations — every fix must reference a specific resource, service, line number, file name, or ID from the uploaded input
- Always cite evidence inline: [log:02:18Z] [tf:main.tf:L44] [k8s:pod/order-svc] [pipeline:step3] [aws:us-east-1:i-0a1b2c3d] [csv:row14]
- When reporting financial, security, or data integrity issues always name exact IDs — never say "orphaned transactions found" without listing them
- Contradictions between files are MORE important than what any single file says — always cross-reference
- Confidence must be explicit on every finding:
  [CONFIRMED] — evidenced by 2+ independent sources
  [LIKELY]    — evidenced by 1 source, consistent with other signals
  [SUSPECTED] — inferred, no direct evidence
  [RULED OUT] — explicitly contradicted by evidence
- Never state [CONFIRMED] without at least 2 citations
- Every timestamp you cite must exist verbatim in the source file — never construct or approximate a timestamp

OUTPUT FORMAT — always use exactly this structure, no exceptions:

═══════════════════════════════════════
FILES IN CONTEXT
═══════════════════════════════════════
[List each file, first line verbatim, line/row count]

═══════════════════════════════════════
SEVERITY
═══════════════════════════════════════
P1 / P2 / P3 / P4
Reason: [one sentence, specific]

P1 = customer-facing, data loss risk, security breach, revenue impact
P2 = degraded service, partial outage, pipeline blocked
P3 = performance issue, non-critical failure, cost anomaly
P4 = warning, drift detected, optimization opportunity

═══════════════════════════════════════
ROOT CAUSE
═══════════════════════════════════════
[Single confirmed cause]
Confidence: [CONFIRMED/LIKELY/SUSPECTED]
Evidence:
  - [citation 1 verbatim]
  - [citation 2 verbatim]

═══════════════════════════════════════
TIMELINE
═══════════════════════════════════════
[HH:MM:SSZ] | [EVENT] | [SOURCE]
Only include timestamps that exist verbatim in source files.

═══════════════════════════════════════
BLAST RADIUS
═══════════════════════════════════════
Services:      [list]
Users/Tenants: [number or UNKNOWN]
Data:          [affected tables, buckets, topics]
Infra:         [affected pods, nodes, regions, pipelines]
Cost impact:   [$ estimate or NOT APPLICABLE]
Security:      [exposed resources or NOT APPLICABLE]

═══════════════════════════════════════
ANOMALIES & DATA FLAGS
═══════════════════════════════════════
For each anomaly:
TYPE: [zero_value | orphaned_resource | duplicate | overflow | impossible_metric | secret_exposed | iam_misconfigured | cost_spike | config_drift | oversell]
ID:       [exact resource ID, transaction ID, pod name, etc.]
DETAIL:   [what is wrong, verbatim evidence]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
ACTION:   [exact next step, who owns it]

═══════════════════════════════════════
CONTRADICTIONS
═══════════════════════════════════════
For each contradiction found across files:
SOURCE A: [file + citation]
SOURCE B: [file + citation]
CONFLICT: [what disagrees]
IMPACT:   [why this matters operationally]

If none: NONE FOUND

═══════════════════════════════════════
RED HERRINGS
═══════════════════════════════════════
For each unrelated event that could cause false attribution:
EVENT:         [what happened]
WHY UNRELATED: [evidence it did not contribute]
RISK:          [could this waste triage time?]

If none: NONE DETECTED

═══════════════════════════════════════
SECURITY & COMPLIANCE FLAGS
═══════════════════════════════════════
[Any exposed secrets, IAM misconfigs, open ports, unencrypted resources, policy violations]
If none: NONE DETECTED

═══════════════════════════════════════
COST FLAGS
═══════════════════════════════════════
[Orphaned resources, unexpected spend, right-sizing opportunities, idle infrastructure]
If none: NONE DETECTED

═══════════════════════════════════════
RECOMMENDATIONS
═══════════════════════════════════════
Max 5, ordered by urgency. Each must follow this format:

[N] URGENCY: immediate / 24h / 1week
    WHAT:    [specific action — not generic advice]
    WHERE:   [exact file, resource, service, line number]
    OWNER:   [team or role]
    FIX:     [exact command, config change, or code snippet if applicable]

═══════════════════════════════════════
OPEN QUESTIONS
═══════════════════════════════════════
[Things that cannot be determined from the uploaded files alone]
[Flag what additional logs, metrics, or access is needed]

If none: NONE
"""

PERSONA_PROMPTS: Dict[str, str] = {
    "sre":      CORE_PROMPT,
    "security": CORE_PROMPT,
    "data":     CORE_PROMPT,
    "devops":   CORE_PROMPT,
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
@app.get("/providers")
async def list_providers():
    result = []
    for pid, preset in PROVIDER_PRESETS.items():
        env_key = preset["env_key"]
        available = (env_key is None) or bool(os.getenv(env_key))
        result.append({
            "id": pid,
            "label": preset["label"],
            "available": available,
            "models": preset["models"],
            "default_model": preset["default_model"],
        })
    return result


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
    provider: str = DEFAULT_PROVIDER
    model: str = DEFAULT_MODEL
    cross_session_ids: List[str] = []  # additional session IDs for cross-file analysis


@app.post("/query")
async def query_document(request: QueryRequest):
    state = sessions.get(request.session_id)
    if state is None:
        raise HTTPException(404, "Session not found. Upload a file first.")
    collection = state["collection"]
    history = state["history"]

    provider = request.provider if request.provider in PROVIDER_PRESETS else DEFAULT_PROVIDER
    preset   = PROVIDER_PRESETS[provider]
    valid_model_ids = [m["id"] for m in preset["models"]]
    model = request.model if request.model in valid_model_ids else preset["default_model"]

    llm = get_openai_client(provider)

    q_emb = embedder.encode([request.query], convert_to_numpy=True).tolist()[0]
    n = max(1, min(5, collection.count()))
    results = collection.query(query_embeddings=[q_emb], n_results=n)
    doc_chunks = results.get("documents", [[]])[0] or ["No relevant context found."]

    # Build primary file context block
    primary_filename = state["filename"]
    primary_chunks_text = "\n\n---\n\n".join(doc_chunks)
    context_blocks = [f"[FILE: {primary_filename}]\n{primary_chunks_text}"]

    # Cross-file context: fetch relevant chunks from each additional session
    cross_ids = [sid for sid in request.cross_session_ids if sid != request.session_id]
    for sid in cross_ids:
        cross_state = sessions.get(sid)
        if not cross_state:
            continue
        try:
            cross_col = cross_state["collection"]
            cn = max(1, min(5, cross_col.count()))
            cross_results = cross_col.query(query_embeddings=[q_emb], n_results=cn)
            cross_chunks = cross_results.get("documents", [[]])[0] or []
            if cross_chunks:
                cross_text = "\n\n---\n\n".join(cross_chunks)
                context_blocks.append(f"[FILE: {cross_state['filename']}]\n{cross_text}")
        except Exception:
            pass

    context = "\n\n══════════════════════════════\n\n".join(context_blocks)

    persona = request.persona if request.persona in PERSONA_PROMPTS else "sre"
    system_prompt = PERSONA_PROMPTS[persona]
    cross_note = (
        f"\n\nNOTE: This query spans {len(context_blocks)} files. "
        "Cross-reference findings across all files. Label evidence by [FILE: name]."
        if len(context_blocks) > 1 else ""
    )
    user_prompt = f"Question: {request.query}\n\nDocument context:\n{context}{cross_note}\n\nProvide a focused analysis."

    # Compact history using a lightweight Groq call (avoids billing on expensive models)
    groq_api_key = os.getenv("GROQ_API_KEY")
    if groq_api_key:
        compactor = Groq(api_key=groq_api_key)
        compacted = compact_history(history, compactor, state["file_type"])
    else:
        compacted = history[-10:]
    state["history"] = compacted

    def event_stream():
        msgs = [{"role": "system", "content": system_prompt}]
        if compacted:
            msgs.extend(compacted[-8:])
        msgs.append({"role": "user", "content": user_prompt})

        output = ""
        stream = llm.chat.completions.create(
            model=model, messages=msgs,
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

        # Generate follow-up suggestions (always use Groq for cost efficiency)
        try:
            followup_client = Groq(api_key=groq_api_key) if groq_api_key else llm
            followup_model  = "llama-3.3-70b-versatile" if groq_api_key else model
            fp = (
                f"Based on this {state['file_type']} analysis:\n"
                f"Q: {request.query}\nA: {output[:400]}...\n\n"
                "Generate exactly 3 short follow-up questions. "
                "Return ONLY a JSON array of 3 strings. No other text."
            )
            fr = followup_client.chat.completions.create(
                model=followup_model,
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


class CronJobRequest(BaseModel):
    session_id: str
    label: str
    query: str
    persona: str = "sre"
    provider: str = "groq"
    model: str = "llama-3.3-70b-versatile"
    interval_minutes: int = 60


@app.post("/cron")
async def create_cron_job(req: CronJobRequest):
    if req.session_id not in sessions:
        raise HTTPException(404, "Session not found.")
    if not 5 <= req.interval_minutes <= 10080:
        raise HTTPException(400, "interval_minutes must be between 5 and 10080 (1 week).")
    job_id = str(uuid.uuid4())
    created_at = datetime.now().isoformat()
    job: Dict = {
        "id": job_id, "session_id": req.session_id, "label": req.label,
        "query": req.query, "persona": req.persona, "provider": req.provider,
        "model": req.model, "interval_minutes": req.interval_minutes,
        "enabled": 1, "last_run": None, "last_result": None, "created_at": created_at,
    }
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO cron_jobs VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
        (job_id, req.session_id, req.label, req.query, req.persona, req.provider,
         req.model, req.interval_minutes, 1, None, None, created_at),
    )
    conn.commit()
    conn.close()
    schedule_job(job)
    return job


@app.get("/cron")
async def list_cron_jobs():
    return load_cron_jobs_db()


@app.delete("/cron/{job_id}")
async def delete_cron_job(job_id: str):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("DELETE FROM cron_jobs WHERE id=?", (job_id,))
    conn.commit()
    conn.close()
    try:
        scheduler.remove_job(job_id)
    except Exception:
        pass
    return {"status": "deleted"}


@app.patch("/cron/{job_id}/toggle")
async def toggle_cron_job(job_id: str):
    conn = sqlite3.connect(DB_PATH)
    row = conn.execute("SELECT enabled FROM cron_jobs WHERE id=?", (job_id,)).fetchone()
    if not row:
        conn.close()
        raise HTTPException(404, "Cron job not found.")
    new_state = 0 if row[0] else 1
    conn.execute("UPDATE cron_jobs SET enabled=? WHERE id=?", (new_state, job_id))
    conn.commit()
    conn.close()
    if new_state:
        jobs = [j for j in load_cron_jobs_db() if j["id"] == job_id]
        if jobs:
            schedule_job(jobs[0])
    else:
        try:
            scheduler.remove_job(job_id)
        except Exception:
            pass
    return {"id": job_id, "enabled": bool(new_state)}


@app.get("/health")
async def health():
    return {"status": "ok", "sessions": len(sessions)}
