import { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000'

const QUERY_TEMPLATES = [
  {
    id: 'incident_report',
    label: 'Full Incident Report',
    prompt:
      'Generate a full incident report with timeline, affected components, root cause, impact assessment, and remediation steps based on this file.'
  },
  {
    id: 'security_audit',
    label: 'Security Audit',
    prompt:
      'Run a security-focused audit of this file and list suspicious patterns, access-control issues, vulnerabilities, and prioritized mitigation steps.'
  },
  {
    id: 'performance_summary',
    label: 'Performance Summary',
    prompt:
      'Provide a performance summary covering bottlenecks, latency/throughput signals, resource pressure, and optimization recommendations.'
  }
]

const SUGGESTIONS = {
  LOG: [
    'What errors are in this log?',
    'Show me the root cause of failures',
    'Are there memory or CPU issues?',
    'Summarize all critical warnings'
  ],
  PDF: [
    'Summarize the key points',
    'What are the main issues mentioned?',
    'List all recommendations',
    'What metrics are reported?'
  ],
  CSV: [
    'What anomalies exist in this data?',
    'Show data statistics',
    'Are there any missing values?',
    'What patterns do you see?'
  ]
}

/* ─── Helpers ─── */
function escapeHtml(v) {
  return v
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMessage(content) {
  const safe = escapeHtml(content)
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^(\d+\.\s)/gm, '<span style="color:var(--cyan);font-family:var(--font-mono);font-size:12px;font-weight:600">$1</span>')
    .replace(/\n/g, '<br/>')
}

/* ─── SVG Icons ─── */
const Icons = {
  logo: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  upload: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  pdf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  csv: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </svg>
  ),
  log: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4 4h16v2H4zM4 10h12v2H4zM4 16h8v2H4z" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  ),
  zap: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M8 12h8M12 8v8" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  play: (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  trash: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

/* ─── Upload Zone ─── */
function UploadZone({ onUpload, isUploading }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) onUpload(f) }}
      onClick={() => inputRef.current?.click()}
      className={`upload-zone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv,.log,.txt"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }}
      />
      {isUploading ? (
        <div className="upload-content">
          <div className="processing-wrap">
            <div className="processing-ring" />
            <span className="upload-text">Indexing file…</span>
          </div>
        </div>
      ) : (
        <div className="upload-content">
          <div className="upload-icon-wrap">
            {Icons.upload}
          </div>
          <span className="upload-title">Drop your file</span>
          <span className="upload-sub">PDF · CSV · LOG · TXT</span>
        </div>
      )}
    </div>
  )
}

/* ─── File Icon Helper ─── */
function FileIconBadge({ type }) {
  const t = type?.toLowerCase()
  return (
    <div className={`file-icon-badge ${t}`}>
      {t === 'pdf' ? Icons.pdf : t === 'csv' ? Icons.csv : Icons.log}
    </div>
  )
}

/* ─── Message Bubble ─── */
function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`message-row ${isUser ? 'user-row' : ''}`}>
      <div className={`avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>
        {isUser ? 'U' : 'AI'}
      </div>
      <div className={`bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
        {message.content === '...' ? (
          <div className="typing-indicator">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        ) : (
          <div
            className="message-text"
            dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Suggestion Chips ─── */
function SuggestionChips({ fileType, onSelect }) {
  const items = SUGGESTIONS[fileType] || SUGGESTIONS.LOG
  return (
    <div className="suggestions-section">
      <div className="suggestions-header">
        <div className="suggestions-header-line" />
        <span className="suggestions-label">QUICK QUERIES</span>
        <div className="suggestions-header-line" />
      </div>
      <div className="suggestions-grid">
        {items.map((q) => (
          <button key={q} className="suggestion-chip" onClick={() => onSelect(q)}>
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Hero / Empty State ─── */
function HeroState() {
  return (
    <div className="hero-state">
      <div className="hero-orb">
        <div className="hero-glow" />
        <div className="hero-orb-ring" />
        <div className="hero-orb-ring-2" />
        <div className="hero-orb-inner">
          {Icons.logo}
        </div>
      </div>

      <h1 className="hero-title">Debugr AI</h1>
      <p className="hero-sub">
        Drop any log, CSV, or document into the sidebar.<br />
        Get instant root-cause analysis, security audits &amp; insights — powered by Llama&nbsp;3.3 70B.
      </p>

      <div className="hero-features">
        <div className="hero-feature">
          <div className="hero-feature-dot cyan" />
          Log Analysis
        </div>
        <div className="hero-feature">
          <div className="hero-feature-dot violet" />
          Security Audit
        </div>
        <div className="hero-feature">
          <div className="hero-feature-dot emerald" />
          Performance
        </div>
        <div className="hero-feature">
          <div className="hero-feature-dot cyan" />
          RAG Search
        </div>
      </div>
    </div>
  )
}

/* ─── App ─── */
export default function App() {
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isQuerying, setIsQuerying] = useState(false)
  const [error, setError] = useState(null)
  const [input, setInput] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(QUERY_TEMPLATES[0].id)
  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  /* Auto-resize textarea */
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  const handleUpload = async (file) => {
    setIsUploading(true)
    setError(null)
    setMessages([])
    setSession(null)
    setInput('')

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.text()) || 'Upload failed.')
      const data = await res.json()
      setSession(data)
      setMessages([
        {
          role: 'assistant',
          content:
            `**${data.filename}** indexed successfully.\n` +
            `Type: **${data.file_type}** · **${data.chunks}** chunks ready.\n\n` +
            'Ask me anything about this file.'
        }
      ])
    } catch (err) {
      setError(`Upload failed: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  const handleQuery = async (forcedQuery) => {
    const query = (forcedQuery ?? input).trim()
    if (!query || !session || isQuerying) return

    setInput('')
    setIsQuerying(true)
    setError(null)

    setMessages((prev) => [
      ...prev,
      { role: 'user', content: query },
      { role: 'assistant', content: '...' }
    ])

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id, query })
      })
      if (!res.ok) throw new Error((await res.text()) || 'Query failed.')
      if (!res.body) throw new Error('No stream from server.')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let agg = ''
      let buf = ''
      let done = false

      while (!done) {
        const { done: d, value } = await reader.read()
        done = d
        if (value) {
          buf += decoder.decode(value, { stream: true })
          const events = buf.split('\n\n')
          buf = events.pop() || ''

          for (const block of events) {
            for (const line of block.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') { done = true; break }
              try {
                const parsed = JSON.parse(payload)
                if (parsed.content) {
                  agg += parsed.content
                  setMessages((prev) => {
                    const updated = [...prev]
                    updated[updated.length - 1] = { role: 'assistant', content: agg }
                    return updated
                  })
                }
              } catch { /* ignore partial SSE */ }
            }
          }
        }
      }
    } catch (err) {
      setError(`Query failed: ${err.message}`)
      setMessages((prev) => {
        const updated = [...prev]
        if (updated.at(-1)?.role === 'assistant') {
          updated[updated.length - 1] = { role: 'assistant', content: 'Could not complete that request. Please try again.' }
        }
        return updated
      })
    } finally {
      setIsQuerying(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleQuery()
    }
  }

  const runTemplate = () => {
    const t = QUERY_TEMPLATES.find((t) => t.id === selectedTemplateId)
    if (t) handleQuery(t.prompt)
  }

  const clearSession = async () => {
    if (session?.session_id) {
      try { await fetch(`${API_BASE}/session/${session.session_id}`, { method: 'DELETE' }) } catch { /* noop */ }
    }
    setSession(null)
    setMessages([])
    setError(null)
    setInput('')
    setIsQuerying(false)
  }

  const fileTypeClass = session?.file_type?.toLowerCase() || ''

  return (
    <div className="app">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon-wrap">
              <div className="logo-icon">{Icons.logo}</div>
            </div>
            <div className="logo-text-group">
              <span className="logo-wordmark">Debugr</span>
              <span className="logo-tagline">RAG · LLM · DevOps</span>
            </div>
          </div>
        </div>

        {/* Upload */}
        <div className="sidebar-section">
          <p className="section-label">Upload File</p>
          <UploadZone onUpload={handleUpload} isUploading={isUploading} />
        </div>

        {/* Active file */}
        {session && (
          <div className="sidebar-section">
            <p className="section-label">Active File</p>
            <div className="file-card">
              <FileIconBadge type={session.file_type} />
              <div className="file-info">
                <p className="file-name">{session.filename}</p>
                <p className="file-meta">{session.chunks} chunks indexed</p>
                <div className="file-status-row">
                  <div className="pulse-dot" />
                  <span className="file-status-text">Live session</span>
                </div>
              </div>
              <span className={`type-pill ${fileTypeClass}`}>{session.file_type}</span>
            </div>
            <button onClick={clearSession} className="btn-ghost-danger">
              {Icons.trash}&nbsp; Clear session
            </button>
          </div>
        )}

        {/* Stack info */}
        <div className="sidebar-footer">
          <p className="stack-header">Stack</p>
          <div className="stack-chips">
            <span className="stack-chip">Llama 3.3 70B</span>
            <span className="stack-chip">ChromaDB</span>
            <span className="stack-chip">RAG</span>
            <span className="stack-chip">FastAPI</span>
            <span className="stack-chip">Groq</span>
          </div>
        </div>
      </aside>

      {/* ─── Main ─── */}
      <main className="main">
        {/* Header */}
        <div className="chat-header">
          <div className="header-left">
            <div className="header-status">
              <div className={`status-indicator ${session ? 'online' : 'offline'}`} />
              <span className="header-filename">
                {session ? (
                  <>Analyzing <strong>{session.filename}</strong></>
                ) : (
                  'No file loaded'
                )}
              </span>
            </div>
          </div>
          <div className="header-right">
            <div className="model-tag">
              <div className="model-tag-dot" />
              Groq · Llama 3.3 70B
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="messages-area">
          {!session && messages.length === 0 && <HeroState />}

          {messages.map((msg, i) => (
            <MessageBubble key={`${msg.role}-${i}`} message={msg} />
          ))}

          {session && messages.length === 1 && (
            <SuggestionChips
              fileType={session.file_type}
              onSelect={(q) => { if (!isQuerying) handleQuery(q) }}
            />
          )}

          {error && (
            <div className="error-toast">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="input-area">
          <div className="template-bar">
            <select
              className="template-select"
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={!session || isQuerying}
            >
              {QUERY_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
            <button className="run-btn" onClick={runTemplate} disabled={!session || isQuerying}>
              <span style={{ width: 12, height: 12, display: 'inline-flex' }}>{Icons.play}</span>
              Run
            </button>
          </div>

          <div className={`input-wrap ${!session ? 'disabled' : ''}`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={session ? 'Ask anything about your file…' : 'Upload a file to start analysis'}
              disabled={!session || isQuerying}
              rows={1}
              className="chat-textarea"
            />
            <button
              onClick={() => handleQuery()}
              disabled={!session || !input.trim() || isQuerying}
              className="send-btn"
              aria-label="Send"
            >
              {isQuerying ? <div className="spinner-sm" /> : Icons.send}
            </button>
          </div>

          <div className="input-footer">
            <span className="input-hint">Shift+Enter for new line · Enter to send</span>
            <span className="char-count">{input.length > 0 ? `${input.length}` : ''}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
