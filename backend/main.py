import io
import json
import os
import re
import uuid
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

app = FastAPI(title="DevOps AI RAG Chatbot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chroma_client = chromadb.Client()
embedder = SentenceTransformer("all-MiniLM-L6-v2")
sessions: Dict[str, Dict[str, Any]] = {}


class QueryRequest(BaseModel):
    session_id: str
    query: str


def parse_pdf(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        page_text = []
        for page in pdf.pages:
            page_text.append(page.extract_text() or "")
    return "\n".join(page_text)


def parse_csv(content: bytes) -> pd.DataFrame:
    return pd.read_csv(io.BytesIO(content))


def csv_to_structured_text(df: pd.DataFrame) -> str:
    rows = []
    rows.append(f"CSV rows: {len(df)}")
    rows.append(f"CSV columns: {len(df.columns)}")
    rows.append(f"Column names: {', '.join(df.columns.astype(str).tolist())}")
    rows.append("")
    rows.append("Row data:")
    rows.append(df.to_string(index=False))
    return "\n".join(rows)


def parse_text(content: bytes) -> str:
    return content.decode("utf-8", errors="ignore")


def chunk_text_by_lines(text: str, chunk_words: int = 500, overlap_words: int = 50) -> List[str]:
    lines = [line for line in text.splitlines() if line.strip()]
    if not lines:
        return []

    chunks: List[str] = []
    current_lines: List[str] = []
    current_word_count = 0

    for line in lines:
        line_word_count = len(line.split())

        if current_lines and current_word_count + line_word_count > chunk_words:
            chunks.append("\n".join(current_lines))

            overlap_lines: List[str] = []
            overlap_count = 0
            for existing_line in reversed(current_lines):
                overlap_lines.insert(0, existing_line)
                overlap_count += len(existing_line.split())
                if overlap_count >= overlap_words:
                    break

            current_lines = overlap_lines.copy()
            current_word_count = sum(len(item.split()) for item in current_lines)

        current_lines.append(line)
        current_word_count += line_word_count

    if current_lines:
        chunks.append("\n".join(current_lines))

    return chunks


def count_pattern_lines(text: str, pattern: str) -> int:
    regex = re.compile(pattern, flags=re.IGNORECASE)
    return sum(1 for line in text.splitlines() if regex.search(line))


def build_text_insights(text: str) -> Dict[str, Any]:
    critical_count = count_pattern_lines(text, r"\b(critical|fatal|panic|segfault|segmentation fault|kernel panic|oom|out of memory)\b")
    error_count = count_pattern_lines(text, r"\b(error|exception|traceback|failed|failure|denied|refused|crash)\b")
    warning_count = count_pattern_lines(text, r"\b(warn|warning|deprecated|retry|timeout|throttl)\b")
    memory_count = count_pattern_lines(text, r"\b(oom|out of memory|memory leak|memory pressure|heap)\b")
    cpu_count = count_pattern_lines(text, r"\b(cpu|high load|load average|throttl)\b")

    summary = (
        f"I found {critical_count} critical indicators, {error_count} error indicators, "
        f"{warning_count} warning indicators, {memory_count} memory signals, and {cpu_count} CPU/load signals."
    )
    findings = []
    if critical_count:
        findings.append(f"{critical_count} critical/fatal patterns detected.")
    if error_count:
        findings.append(f"{error_count} error/exception patterns detected.")
    if warning_count:
        findings.append(f"{warning_count} warning/timeout patterns detected.")
    if memory_count:
        findings.append(f"{memory_count} memory-related indicators detected.")
    if cpu_count:
        findings.append(f"{cpu_count} CPU/load indicators detected.")
    if not findings:
        findings.append("No obvious critical patterns were detected via quick heuristic scan.")

    return {
        "summary": summary,
        "findings": findings,
        "metrics": {
            "critical": critical_count,
            "errors": error_count,
            "warnings": warning_count,
            "memory_signals": memory_count,
            "cpu_signals": cpu_count,
        },
    }


def build_csv_insights(df: pd.DataFrame) -> Dict[str, Any]:
    missing_values = int(df.isna().sum().sum())
    numeric = df.select_dtypes(include=["number"])
    outlier_count = 0

    for column in numeric.columns:
        series = numeric[column].dropna()
        if len(series) < 4:
            continue
        std = series.std()
        if std is None or std == 0:
            continue
        z_scores = ((series - series.mean()) / std).abs()
        outlier_count += int((z_scores > 3).sum())

    summary = (
        f"I found {missing_values} missing values, {outlier_count} potential numeric outliers, "
        f"across {len(df.columns)} columns and {len(df)} rows."
    )
    findings = [
        f"Rows: {len(df)} | Columns: {len(df.columns)}",
        f"Missing values: {missing_values}",
        f"Potential outliers (z-score > 3): {outlier_count}",
    ]

    return {
        "summary": summary,
        "findings": findings,
        "metrics": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "missing_values": missing_values,
            "potential_outliers": outlier_count,
        },
    }


def detect_auto_insights(file_type: str, text: str, dataframe: Optional[pd.DataFrame] = None) -> Dict[str, Any]:
    if file_type == "CSV" and dataframe is not None:
        return build_csv_insights(dataframe)
    return build_text_insights(text)


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is missing.")

    filename = file.filename
    extension = filename.lower().rsplit(".", maxsplit=1)[-1] if "." in filename else ""
    content = await file.read()

    csv_dataframe: Optional[pd.DataFrame] = None

    if extension == "pdf":
        extracted_text = parse_pdf(content)
        file_type = "PDF"
    elif extension == "csv":
        csv_dataframe = parse_csv(content)
        extracted_text = csv_to_structured_text(csv_dataframe)
        file_type = "CSV"
    elif extension in {"log", "txt"}:
        extracted_text = parse_text(content)
        file_type = "LOG"
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, CSV, LOG, or TXT.")

    if not extracted_text.strip():
        raise HTTPException(status_code=400, detail="No text content could be extracted from the file.")

    chunks = chunk_text_by_lines(extracted_text, chunk_words=500, overlap_words=50)
    if not chunks:
        raise HTTPException(status_code=400, detail="Unable to create chunks from uploaded file.")

    session_id = str(uuid.uuid4())
    collection = chroma_client.create_collection(name=session_id)

    embeddings = embedder.encode(chunks, convert_to_numpy=True).tolist()
    collection.add(
        documents=chunks,
        embeddings=embeddings,
        ids=[f"{session_id}-chunk-{idx}" for idx in range(len(chunks))],
        metadatas=[{"filename": filename, "file_type": file_type} for _ in chunks],
    )

    auto_insights = detect_auto_insights(file_type=file_type, text=extracted_text, dataframe=csv_dataframe)
    sessions[session_id] = {
        "collection": collection,
        "history": [],
        "filename": filename,
        "file_type": file_type,
        "auto_insights": auto_insights,
    }

    return {
        "session_id": session_id,
        "filename": filename,
        "chunks": len(chunks),
        "file_type": file_type,
        "auto_insights": auto_insights,
    }


@app.post("/query")
async def query_document(request: QueryRequest):
    session_state = sessions.get(request.session_id)
    if session_state is None:
        raise HTTPException(status_code=404, detail="Session not found. Upload a file first.")
    collection = session_state["collection"]
    history = session_state["history"]

    groq_api_key = os.getenv("GROQ_API_KEY")
    if not groq_api_key:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not set in the environment.")

    query_embedding = embedder.encode([request.query], convert_to_numpy=True).tolist()[0]
    result_count = max(1, min(5, collection.count()))
    results = collection.query(query_embeddings=[query_embedding], n_results=result_count)

    context_chunks = results.get("documents", [[]])[0] or []
    if not context_chunks:
        context_chunks = ["No relevant context found in the uploaded document."]
    context = "\n\n---\n\n".join(context_chunks)

    system_prompt = (
        "You are an expert DevOps assistant. Analyze user-provided technical files and answer clearly. "
        "Always structure your response with these sections:\n"
        "1) Summary\n"
        "2) Issues Detected\n"
        "3) Root Cause\n"
        "4) Recommendations\n"
        "Be precise, actionable, and evidence-based using the provided context."
    )
    user_prompt = (
        f"Question: {request.query}\n\n"
        f"Retrieved context:\n{context}\n\n"
        "Provide a focused DevOps analysis."
    )

    groq_client = Groq(api_key=groq_api_key)

    def event_stream():
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            messages.extend(history[-8:])
        messages.append({"role": "user", "content": user_prompt})

        assistant_output = ""
        stream = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            temperature=0.1,
            max_tokens=2048,
            stream=True,
        )

        for part in stream:
            token = part.choices[0].delta.content if part.choices else None
            if token:
                assistant_output += token
                payload = json.dumps({"content": token})
                yield f"data: {payload}\n\n"

        history.append({"role": "user", "content": request.query})
        history.append({"role": "assistant", "content": assistant_output.strip()})
        if len(history) > 20:
            del history[:-20]

        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    session_state = sessions.pop(session_id, None)
    if session_state is not None:
        chroma_client.delete_collection(name=session_id)
    return {"status": "deleted"}


@app.get("/health")
async def health():
    return {"status": "ok"}
