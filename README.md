# DevOps AI Assistant 🤖

A professional RAG-powered chatbot for analyzing logs, CSVs, and PDFs. Built with React, FastAPI, ChromaDB, and Groq (Llama 3.3 70B).

## Tech Stack

| Layer | Tool |
|---|---|
| LLM | Groq - Llama 3.3 70B (Free) |
| Embeddings | sentence-transformers all-MiniLM-L6-v2 (Free) |
| Vector DB | ChromaDB (Free) |
| Backend | FastAPI + Python |
| Frontend | React + Vite |

## Project Structure

```
devops-assistant/
├── backend/
│   ├── main.py          # FastAPI app with RAG pipeline
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.jsx      # Main React app
    │   ├── index.css    # All styles
    │   └── main.jsx     # Entry point
    ├── index.html
    ├── package.json
    └── vite.config.js
```

## Setup

### 1. Get Free Groq API Key
- Go to https://console.groq.com
- Sign up and get your free API key

### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
export GROQ_API_KEY=your_groq_api_key_here
uvicorn main:app --reload --port 8000
```

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Features

- **Upload** PDF, CSV, or log files (drag & drop supported)
- **Smart chunking** with overlap for better context retrieval
- **Semantic search** using ChromaDB + sentence-transformers
- **Streaming responses** — answers appear token by token
- **Suggested queries** based on file type
- **Session management** — clear and start fresh anytime

## How It Works (RAG Pipeline)

1. File uploaded → parsed (PDF/CSV/log)
2. Text split into overlapping chunks (500 words, 50 word overlap)
3. Chunks embedded using all-MiniLM-L6-v2
4. Embeddings stored in ChromaDB (in-memory)
5. User query → embedded → semantic search → top 5 chunks retrieved
6. Chunks injected into Llama 3.3 70B prompt
7. Streamed response back to UI

## Future Improvements

- [ ] Persistent ChromaDB storage (don't lose data on restart)
- [ ] Multi-file support per session
- [ ] Chat history with local storage
- [ ] Swap Groq → OpenAI GPT-4o with one env var change
- [ ] Docker Compose for easy deployment
- [ ] Deploy backend to Railway (free tier)
- [ ] Deploy frontend to Vercel (free)

## Deployment (Free)

**Backend:** Railway.app
```bash
# Add GROQ_API_KEY as environment variable in Railway dashboard
```

**Frontend:** Vercel
```bash
# Update API_BASE in App.jsx to your Railway URL
vercel deploy
```
