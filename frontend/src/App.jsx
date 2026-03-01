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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMessage(content) {
  const safe = escapeHtml(content)
  return safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
}

function FileIcon({ type }) {
  const icons = {
    PDF: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    CSV: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <line x1="3" y1="9" x2="21" y2="9" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="9" y1="3" x2="9" y2="21" />
        <line x1="15" y1="3" x2="15" y2="21" />
      </svg>
    ),
    LOG: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
        <path d="M4 4h16v2H4zM4 10h16v2H4zM4 16h10v2H4z" />
      </svg>
    )
  }
  return icons[type] || icons.LOG
}

function UploadZone({ onUpload, isUploading }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleDrop = (event) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`upload-zone ${isDragging ? 'dragging' : ''} ${isUploading ? 'uploading' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.csv,.log,.txt"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) onUpload(file)
          event.target.value = ''
        }}
      />
      {isUploading ? (
        <div className="upload-content">
          <div className="spinner" />
          <span className="upload-text">Processing & indexing...</span>
        </div>
      ) : (
        <div className="upload-content">
          <div className="upload-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <span className="upload-title">Drop your file here</span>
          <span className="upload-sub">PDF · CSV · LOG · TXT</span>
        </div>
      )}
    </div>
  )
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`message-row ${isUser ? 'user-row' : 'assistant-row'}`}>
      <div className={`message-avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>{isUser ? 'U' : 'AI'}</div>
      <div className={`message-bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
        {message.content === '...' ? (
          <div className="typing-dots">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <div className="message-text" dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }} />
        )}
      </div>
    </div>
  )
}

function SuggestedQueries({ fileType, onSelect }) {
  const suggestions = {
    LOG: [
      'What errors are in this log?',
      'Show me the root cause of failures',
      'Are there any memory or CPU issues?',
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
      'Show me the data statistics',
      'Are there any missing values?',
      'What patterns do you see?'
    ]
  }

  const items = suggestions[fileType] || suggestions.LOG

  return (
    <div className="suggestions">
      <p className="suggestions-label">Suggested queries</p>
      <div className="suggestions-grid">
        {items.map((query) => (
          <button key={query} onClick={() => onSelect(query)} className="suggestion-chip" disabled={false}>
            {query}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [isQuerying, setIsQuerying] = useState(false)
  const [error, setError] = useState(null)
  const [input, setInput] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState(QUERY_TEMPLATES[0].id)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isQuerying])

  const handleUpload = async (file) => {
    setIsUploading(true)
    setError(null)
    setMessages([])
    setSession(null)
    setInput('')

    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || 'Upload failed.')
      }

      const data = await response.json()
      setSession(data)

      const insightSummary = data.auto_insights?.summary ? `\n\n**Auto-detected scan:** ${data.auto_insights.summary}` : ''
      const findingLines = data.auto_insights?.findings?.length
        ? `\n\nTop findings:\n${data.auto_insights.findings.slice(0, 3).map((item) => `- ${item}`).join('\n')}`
        : ''

      setMessages([
        {
          role: 'assistant',
          content:
            `File **${data.filename}** was indexed successfully.\n` +
            `Type: **${data.file_type}** | Chunks: **${data.chunks}**\n\n` +
            'Ask your first question to begin analysis.' +
            insightSummary +
            findingLines
        }
      ])
    } catch (uploadError) {
      setError(`Upload failed: ${uploadError.message}`)
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

    setMessages((previous) => [...previous, { role: 'user', content: query }, { role: 'assistant', content: '...' }])

    try {
      const response = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id, query })
      })

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(detail || 'Query failed.')
      }

      if (!response.body) {
        throw new Error('No response stream from server.')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let aggregated = ''
      let buffer = ''
      let done = false

      while (!done) {
        const read = await reader.read()
        done = read.done
        if (read.value) {
          buffer += decoder.decode(read.value, { stream: true })
          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const eventBlock of events) {
            const lines = eventBlock.split('\n')
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') {
                done = true
                break
              }
              try {
                const parsed = JSON.parse(payload)
                if (parsed.content) {
                  aggregated += parsed.content
                  setMessages((previous) => {
                    const updated = [...previous]
                    updated[updated.length - 1] = { role: 'assistant', content: aggregated }
                    return updated
                  })
                }
              } catch {
                // Ignore partial/non-JSON SSE lines.
              }
            }
          }
        }
      }
    } catch (queryError) {
      setError(`Query failed: ${queryError.message}`)
      setMessages((previous) => {
        const updated = [...previous]
        if (updated.at(-1)?.role === 'assistant') {
          updated[updated.length - 1] = {
            role: 'assistant',
            content: 'I could not complete that request. Please try again.'
          }
        }
        return updated
      })
    } finally {
      setIsQuerying(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleQuery()
    }
  }

  const runTemplate = () => {
    const template = QUERY_TEMPLATES.find((item) => item.id === selectedTemplateId)
    if (!template) return
    handleQuery(template.prompt)
  }

  const clearSession = async () => {
    if (session?.session_id) {
      try {
        await fetch(`${API_BASE}/session/${session.session_id}`, { method: 'DELETE' })
      } catch {
        // Reset locally even if backend delete fails.
      }
    }
    setSession(null)
    setMessages([])
    setError(null)
    setInput('')
    setIsQuerying(false)
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="logo-text">
              DevOps<span className="logo-accent">AI</span>
            </span>
          </div>
          <p className="logo-sub">RAG-powered document analysis</p>
        </div>

        <div className="sidebar-section">
          <p className="section-label">UPLOAD FILE</p>
          <UploadZone onUpload={handleUpload} isUploading={isUploading} />
        </div>

        {session && (
          <div className="sidebar-section">
            <p className="section-label">ACTIVE FILE</p>
            <div className="file-card">
              <div className="file-icon">
                <FileIcon type={session.file_type} />
              </div>
              <div className="file-info">
                <p className="file-name">{session.filename}</p>
                <p className="file-meta">{session.chunks} chunks indexed</p>
                <div className="file-status">
                  <span className="status-dot active" />
                  Active session
                </div>
              </div>
              <span className={`file-badge badge-${session.file_type.toLowerCase()}`}>{session.file_type}</span>
            </div>
            <button onClick={clearSession} className="clear-btn">
              Clear session
            </button>
          </div>
        )}

        <div className="sidebar-footer">
          <div className="stack-info">
            <p className="stack-label">STACK</p>
            <div className="stack-tags">
              <span className="tag">Llama 3.3 70B</span>
              <span className="tag">ChromaDB</span>
              <span className="tag">RAG</span>
              <span className="tag">FastAPI</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="main">
        <div className="chat-header">
          <div className="chat-title">
            {session ? (
              <>
                <span className="status-dot active" />
                Analyzing <strong>{session.filename}</strong>
              </>
            ) : (
              <>
                <span className="status-dot inactive" />
                No file loaded
              </>
            )}
          </div>
          <div className="model-badge">
            <span className="model-dot" />
            Groq · Llama 3.3 70B
          </div>
        </div>

        <div className="messages-area">
          {!session && messages.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
              </div>
              <h2 className="empty-title">Upload a file to get started</h2>
              <p className="empty-sub">
                Drop a PDF, CSV, or log file in the sidebar.
                <br />
                Ask questions and get real-time AI analysis.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <MessageBubble key={`${message.role}-${index}`} message={message} />
          ))}

          {session && messages.length === 1 && (
            <SuggestedQueries
              fileType={session.file_type}
              onSelect={(query) => {
                if (!isQuerying) handleQuery(query)
              }}
            />
          )}

          {error && <div className="error-bar">{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        <div className="input-area">
          <div className="template-row">
            <select
              className="template-select"
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              disabled={!session || isQuerying}
            >
              {QUERY_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <button className="template-btn" onClick={runTemplate} disabled={!session || isQuerying}>
              Run template
            </button>
          </div>
          <div className={`input-container ${!session ? 'disabled' : ''}`}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={session ? 'Ask anything about your file...' : 'Upload a file to start chatting'}
              disabled={!session || isQuerying}
              rows={2}
              className="chat-input"
            />
            <button onClick={() => handleQuery()} disabled={!session || !input.trim() || isQuerying} className="send-btn">
              {isQuerying ? (
                <div className="spinner-sm" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              )}
            </button>
          </div>
          <p className="input-hint">Shift+Enter for new line · Enter to send</p>
        </div>
      </main>
    </div>
  )
}
