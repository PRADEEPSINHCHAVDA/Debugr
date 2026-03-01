from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import chromadb
from chromadb.utils import embedding_functions
from groq import Groq
import pdfplumber
import pandas as pd
import io
import uuid
import os
import json
import re
from typing import Optional
import asyncio

app = FastAPI(title="DevOps AI Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize ChromaDB
chroma_client = chromadb.Client()
embedding_fn = embedding_functions.SentenceTransformerEmbeddingFunction(
    model_name="all-MiniLM-L6-v2"
)

# Groq client
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", "your-groq-api-key"))

# Store collections per session
collections = {}

class QueryRequest(BaseModel):
    session_id: str
    query: str

class SessionResponse(BaseModel):
    session_id: str
    filename: str
    chunks: int
    file_type: str

def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Smart chunking with overlap"""
    lines = text.split('\n')
    chunks = []
    current_chunk = []
    current_size = 0
    
    for line in lines:
        line_size = len(line.split())
        if current_size + line_size > chunk_size and current_chunk:
            chunks.append('\n'.join(current_chunk))
            # overlap: keep last few lines
            overlap_lines = current_chunk[-3:] if len(current_chunk) > 3 else current_chunk
            current_chunk = overlap_lines.copy()
            current_size = sum(len(l.split()) for l in current_chunk)
        current_chunk.append(line)
        current_size += line_size
    
    if current_chunk:
        chunks.append('\n'.join(current_chunk))
    
    return [c for c in chunks if c.strip()]

def parse_pdf(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        return '\n'.join(page.extract_text() or '' for page in pdf.pages)

def parse_csv(content: bytes) -> str:
    df = pd.read_csv(io.BytesIO(content))
    # Convert to structured text
    result = f"CSV Data with {len(df)} rows and {len(df.columns)} columns.\n"
    result += f"Columns: {', '.join(df.columns.tolist())}\n\n"
    result += df.to_string(index=False)
    return result

def parse_log(content: bytes) -> str:
    return content.decode('utf-8', errors='ignore')

@app.post("/upload", response_model=SessionResponse)
async def upload_file(file: UploadFile = File(...)):
    content = await file.read()
    filename = file.filename.lower()
    session_id = str(uuid.uuid4())
    
    # Parse based on file type
    if filename.endswith('.pdf'):
        text = parse_pdf(content)
        file_type = "PDF"
    elif filename.endswith('.csv'):
        text = parse_csv(content)
        file_type = "CSV"
    else:  # treat as log/text
        text = parse_log(content)
        file_type = "LOG"
    
    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from file")
    
    # Chunk the text
    chunks = chunk_text(text)
    
    # Create ChromaDB collection for this session
    collection = chroma_client.create_collection(
        name=session_id,
        embedding_function=embedding_fn
    )
    
    # Add chunks to collection
    collection.add(
        documents=chunks,
        ids=[f"chunk_{i}" for i in range(len(chunks))]
    )
    
    collections[session_id] = collection
    
    return SessionResponse(
        session_id=session_id,
        filename=file.filename,
        chunks=len(chunks),
        file_type=file_type
    )

@app.post("/query")
async def query_document(request: QueryRequest):
    if request.session_id not in collections:
        raise HTTPException(status_code=404, detail="Session not found. Please upload a file first.")
    
    collection = collections[request.session_id]
    
    # Semantic search - get top 5 relevant chunks
    results = collection.query(
        query_texts=[request.query],
        n_results=min(5, collection.count())
    )
    
    context = '\n\n---\n\n'.join(results['documents'][0])
    
    # Build prompt
    system_prompt = """You are an expert DevOps AI assistant specialized in analyzing logs, CSVs, and technical documents.
    
Your job is to:
- Identify errors, warnings, anomalies, and patterns
- Provide root cause analysis for issues
- Suggest actionable fixes and improvements  
- Be precise, technical, and concise

Always structure your response with clear sections when analyzing logs:
1. **Summary** - what you found
2. **Issues Detected** - specific problems with line references if available
3. **Root Cause** - why it's happening
4. **Recommendations** - what to do next"""

    user_prompt = f"""Based on the following document content, answer this question: {request.query}

DOCUMENT CONTENT:
{context}

Provide a detailed, technical analysis."""

    def generate():
        stream = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            stream=True,
            max_tokens=2048,
            temperature=0.1
        )
        
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'content': chunk.choices[0].delta.content})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")

@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    if session_id in collections:
        chroma_client.delete_collection(session_id)
        del collections[session_id]
    return {"status": "cleared"}

@app.get("/health")
async def health():
    return {"status": "ok"}
