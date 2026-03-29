import { useEffect, useRef, useState } from 'react'

const API_BASE = 'http://localhost:8000'

/* ─── SVG Icon components ─── */
const Icon = {
  Wrench: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  Shield: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  BarChart: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Download: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  ThumbUp: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>,
  ThumbDown: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>,
  AlertTriangle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  AlertCircle: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Zap: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  Memory: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 12h.01M10 12h.01M14 12h.01M18 12h.01"/></svg>,
  Cpu: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>,
  Clock: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Play: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Pause: () => <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>,
  X: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Circle: ({ color }) => <svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill={color}/></svg>,
}

const PERSONAS = [
  { id: 'sre',      label: 'SRE — Root Cause & Reliability',  desc: 'Incident response, postmortems, K8s, DB', icon: 'Wrench' },
  { id: 'security', label: 'Security — Threat & Compliance',  desc: 'IAM, secrets, policy drift, breaches',    icon: 'Shield' },
  { id: 'data',     label: 'Data — Anomaly & Integrity',      desc: 'Metrics, CSV, billing, data quality',     icon: 'BarChart' },
  { id: 'devops',   label: 'DevOps — CI/CD & IaC',            desc: 'Pipelines, Terraform, cost, infra drift', icon: 'Cpu' },
]

const SKILLS = [
  { id: 's1', label: 'Full Incident Report',   color: 'red',    prompt: 'Generate a full incident report with timeline, affected components, root cause, impact assessment, and remediation steps.' },
  { id: 's2', label: 'Security Audit',          color: 'orange', prompt: 'Run a security audit. List suspicious patterns, access-control issues, exposed secrets, vulnerabilities, and prioritized mitigations.' },
  { id: 's3', label: 'Performance Analysis',    color: 'violet', prompt: 'Provide a performance analysis: bottlenecks, latency/throughput signals, resource pressure, and optimization recommendations.' },
  { id: 's4', label: 'OOM / Memory Analysis',   color: 'red',    prompt: 'Analyze memory issues: out-of-memory events, heap pressure, memory leaks, and remediation steps.' },
  { id: 's5', label: 'Error Pattern Mining',    color: 'orange', prompt: 'Find all recurring error patterns, group them by type, frequency, and time, and suggest root causes.' },
  { id: 's6', label: 'Timeline Reconstruction', color: 'cyan',   prompt: 'Reconstruct a chronological timeline of key events from this file, highlighting anomalies or incidents.' },
  { id: 's7', label: 'Data Anomaly Scan',       color: 'emerald',prompt: 'Scan for data anomalies: outliers, missing values, type mismatches, duplicates, and statistical irregularities.' },
  { id: 's8', label: 'Quick Summary',           color: 'cyan',   prompt: 'Give me a concise 5-bullet executive summary of the most important findings in this file.' },
]

const SUGGESTIONS = {
  LOG: ['What errors are in this log?','Show me the root cause of failures','Are there memory or CPU issues?','Summarize all critical warnings'],
  PDF: ['Summarize the key points','What are the main issues mentioned?','List all recommendations','What metrics are reported?'],
  CSV: ['What anomalies exist in this data?','Show data statistics','Are there missing values?','What patterns do you see?'],
}

const CRITICAL_PATTERN = /\b(critical|fatal|panic|oom|out of memory|segfault|kernel panic|breach|exploit|compromised)\b/i

/* ─── Helpers ─── */
function escapeHtml(v) {
  return v.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
}

function renderInline(text) {
  const safe = escapeHtml(text)
  return safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>')
}

/* ─── CodeBlock ─── */
function CodeBlock({ code, lang }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="code-block-wrap">
      <div className="code-block-header">
        <span className="code-lang">{lang || 'code'}</span>
        <button className={`copy-btn${copied ? ' copied' : ''}`} onClick={copy}>{copied ? '✓ Copied' : 'Copy'}</button>
      </div>
      <pre className="code-block"><code>{code}</code></pre>
    </div>
  )
}

/* ─── MarkdownMessage ─── */
function MarkdownMessage({ content }) {
  const lines = content.split('\n')
  const elements = []
  let i = 0, k = 0
  const key = () => k++

  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const codeLines = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++ }
      elements.push(<CodeBlock key={key()} code={codeLines.join('\n')} lang={lang} />)
      i++; continue
    }
    if (line.startsWith('## ')) { elements.push(<h3 key={key()} className="md-h2" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(3)) }} />); i++; continue }
    if (line.startsWith('### ')) { elements.push(<h4 key={key()} className="md-h3" dangerouslySetInnerHTML={{ __html: renderInline(line.slice(4)) }} />); i++; continue }
    if (line.trim() === '---') { elements.push(<hr key={key()} className="md-hr" />); i++; continue }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(<li key={key()} dangerouslySetInnerHTML={{ __html: renderInline(lines[i].slice(2)) }} />); i++
      }
      elements.push(<ul key={key()} className="md-ul">{items}</ul>); continue
    }
    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(<li key={key()} dangerouslySetInnerHTML={{ __html: renderInline(lines[i].replace(/^\d+\.\s/, '')) }} />); i++
      }
      elements.push(<ol key={key()} className="md-ol">{items}</ol>); continue
    }
    if (line.trim() === '') { i++; continue }
    elements.push(<p key={key()} className="md-p" dangerouslySetInnerHTML={{ __html: renderInline(line) }} />)
    i++
  }
  return <div className="markdown-body">{elements}</div>
}

/* ─── AutoTriageBar ─── */
function AutoTriageBar({ metrics, fileType }) {
  if (!metrics) return null
  const isCSV = fileType === 'CSV'
  const chips = isCSV ? [
    metrics.rows        && { cls: 'rows',     label: `${metrics.rows} rows` },
    metrics.columns     && { cls: 'rows',     label: `${metrics.columns} cols` },
    metrics.missing_values  && { cls: 'missing', label: `${metrics.missing_values} missing` },
    metrics.potential_outliers && { cls: 'outliers', label: `${metrics.potential_outliers} outliers` },
  ] : [
    metrics.critical    && { cls: 'critical', label: `${metrics.critical} critical`,  icon: 'AlertCircle' },
    metrics.errors      && { cls: 'errors',   label: `${metrics.errors} errors`,      icon: 'AlertTriangle' },
    metrics.warnings    && { cls: 'warnings', label: `${metrics.warnings} warnings`,  icon: 'Zap' },
    metrics.memory_signals && { cls: 'memory', label: `${metrics.memory_signals} memory`, icon: 'Memory' },
    metrics.cpu_signals    && { cls: 'cpu',    label: `${metrics.cpu_signals} CPU`,       icon: 'Cpu' },
  ]
  const active = chips.filter(Boolean)
  if (!active.length) return null
  return (
    <div className="auto-triage-bar">
      <span className="triage-label">Quick scan</span>
      {active.map((c, i) => {
        const IconComp = c.icon ? Icon[c.icon] : null
        return (
          <span key={i} className={`triage-chip ${c.cls}`}>
            {IconComp && <IconComp />}{c.label}
          </span>
        )
      })}
    </div>
  )
}

/* ─── AlertBanner ─── */
function AlertBanner({ text, onDismiss }) {
  return (
    <div className="alert-banner">
      <span className="alert-banner-text"><Icon.AlertTriangle /> {text}</span>
      <button className="alert-dismiss" onClick={onDismiss}><Icon.X /></button>
    </div>
  )
}

/* ─── MessageBubble ─── */
function MessageBubble({ message, index, feedback, onFeedback, onRetry, onEdit, isLastAI, isQuerying }) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(message.content)

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  const handleEditSubmit = () => {
    if (editVal.trim() && editVal.trim() !== message.content) {
      onEdit(index, editVal.trim())
    }
    setEditing(false)
  }

  return (
    <div className={`message-row ${isUser ? 'user-row' : ''}`}>
      <div className={`avatar ${isUser ? 'user-avatar' : 'ai-avatar'}`}>{isUser ? 'U' : 'AI'}</div>
      <div style={{ minWidth: 0, flex: 1, maxWidth: '72%' }}>
        <div className={`bubble ${isUser ? 'user-bubble' : 'ai-bubble'}`}>
          {message.content === '...' ? (
            <div className="typing-indicator">
              <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
            </div>
          ) : editing ? (
            <div className="edit-wrap">
              <textarea
                className="edit-textarea"
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleEditSubmit() }}
                autoFocus
                rows={3}
              />
              <div className="edit-actions">
                <button className="edit-confirm-btn" onClick={handleEditSubmit}>Resubmit</button>
                <button className="edit-cancel-btn" onClick={() => { setEditing(false); setEditVal(message.content) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <MarkdownMessage content={message.content} />
          )}
        </div>
        {message.content !== '...' && !editing && (
          <div className="message-footer">
            {/* Copy — always shown */}
            <button className={`msg-action-btn${copied ? ' copied' : ''}`} onClick={handleCopy} title="Copy">
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="1"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              )}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {/* Edit — user messages only */}
            {isUser && (
              <button className="msg-action-btn" onClick={() => { setEditVal(message.content); setEditing(true) }} title="Edit & resubmit">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
            )}

            {/* Retry — last AI message only */}
            {!isUser && isLastAI && (
              <button className="msg-action-btn retry-btn" onClick={onRetry} disabled={isQuerying} title="Retry for better response">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                Retry
              </button>
            )}

            {/* Feedback — AI messages only */}
            {!isUser && (
              <>
                <button className={`feedback-btn${feedback === 'up' ? ' active up' : ''}`} onClick={() => onFeedback(index, 'up')} title="Helpful"><Icon.ThumbUp /></button>
                <button className={`feedback-btn${feedback === 'down' ? ' active down' : ''}`} onClick={() => onFeedback(index, 'down')} title="Not helpful"><Icon.ThumbDown /></button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── FollowUpChips ─── */
function FollowUpChips({ chips, onSelect, disabled }) {
  if (!chips.length) return null
  return (
    <div className="followup-section">
      <div className="followup-label">SUGGESTED FOLLOW-UPS</div>
      <div className="followup-row">
        {chips.map((q, i) => (
          <button key={i} className="followup-chip" disabled={disabled} onClick={() => onSelect(q)}>{q}</button>
        ))}
      </div>
    </div>
  )
}

/* ─── SuggestionChips ─── */
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
        {items.map((q) => <button key={q} className="suggestion-chip" onClick={() => onSelect(q)}>{q}</button>)}
      </div>
    </div>
  )
}

/* ─── SkillsPanel ─── */
function SkillsPanel({ onSelect, disabled }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="skills-section">
      <button className="skills-toggle" onClick={() => setOpen(o => !o)}>
        <span className="skills-toggle-label">Skills</span>
        <span className={`skills-toggle-arrow${open ? ' open' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="skills-grid">
          {SKILLS.map(s => (
            <button key={s.id} className="skill-btn" disabled={disabled} onClick={() => onSelect(s.prompt)}>
              <div className={`skill-dot ${s.color}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── FileIconBadge ─── */
function FileIconBadge({ type }) {
  const t = type?.toLowerCase()
  const icons = {
    pdf: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    csv: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg>,
    log: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:16,height:16}}><path d="M4 4h16v2H4zM4 10h12v2H4zM4 16h8v2H4z"/></svg>,
  }
  return <div className={`file-icon-badge ${t}`}>{icons[t] || icons.log}</div>
}


/* ─── HeroState ─── */
function HeroState({ onUpload, isUploading, inputRef }) {
  const [isDragging, setIsDragging] = useState(false)
  const localRef = useRef(null)
  const ref = inputRef || localRef

  const handleDrop = (e) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) onUpload(f)
  }

  return (
    <div
      className={`hero-drop${isDragging ? ' dragging' : ''}${isUploading ? ' uploading' : ''}`}
      onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      onClick={() => !isUploading && ref.current?.click()}
    >
      <input ref={ref} type="file" accept=".pdf,.csv,.log,.txt,.env" style={{display:'none'}}
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = '' }} />

      {isUploading ? (
        <div className="hero-drop-inner">
          <div className="processing-ring" style={{width:40,height:40}} />
          <p className="hero-drop-title">Indexing file…</p>
          <p className="hero-drop-sub">Building vector embeddings</p>
        </div>
      ) : (
        <div className="hero-drop-inner">
          <div className="hero-drop-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
          </div>
          <p className="hero-drop-title">{isDragging ? 'Release to upload' : 'Drop your file here'}</p>
          <p className="hero-drop-sub">PDF · CSV · LOG · TXT · ENV</p>
          <div className="hero-drop-tags">
            {['Log Analysis','Security Audit','Performance','Root Cause'].map(t => (
              <span key={t} className="hero-drop-tag">{t}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── CronPanel ─── */
function CronPanel({ session, cronJobs, onAdd, onDelete, onToggle }) {
  const [open, setOpen]         = useState(false)
  const [label, setLabel]       = useState('')
  const [query, setCronQuery]   = useState('')
  const [interval, setInterval] = useState(60)
  const [adding, setAdding]     = useState(false)

  const fmt = (iso) => {
    if (!iso) return 'Never'
    try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
    catch { return iso }
  }

  const handleAdd = async () => {
    if (!session || !label.trim() || !query.trim()) return
    setAdding(true)
    await onAdd({ label: label.trim(), query: query.trim(), interval_minutes: Number(interval) })
    setLabel(''); setCronQuery(''); setInterval(60); setAdding(false)
  }

  return (
    <div className="skills-section">
      <button className="skills-toggle" onClick={() => setOpen(o => !o)}>
        <span className="skills-toggle-label" style={{ display:'flex', alignItems:'center', gap:5 }}><Icon.Clock /> Scheduled Scans ({cronJobs.length})</span>
        <span className={`skills-toggle-arrow${open ? ' open' : ''}`}>▼</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Existing jobs */}
          {cronJobs.map(j => (
            <div key={j.id} className="file-card" style={{ flexDirection: 'column', alignItems: 'stretch', padding: '8px 10px', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>{j.label}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="skill-btn" style={{ padding: '2px 7px', fontSize: 10 }}
                    onClick={() => onToggle(j.id)}>
                    {j.enabled ? <><Icon.Pause /> Pause</> : <><Icon.Play /> Resume</>}
                  </button>
                  <button className="btn-ghost-danger" style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => onDelete(j.id)}><Icon.X /></button>
                </div>
              </div>
              <p className="file-meta" style={{ marginTop: 2 }}>Every {j.interval_minutes}m · Last: {fmt(j.last_run)}</p>
              {j.last_result && (
                <p className="file-meta" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {j.last_result.slice(0, 80)}…
                </p>
              )}
            </div>
          ))}

          {/* Add new job */}
          {session ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, paddingTop: 4 }}>
              <input
                className="persona-select"
                placeholder="Label (e.g. Hourly error check)"
                value={label}
                onChange={e => setLabel(e.target.value)}
                style={{ fontSize: 11 }}
              />
              <textarea
                className="persona-select"
                placeholder="Query to run automatically…"
                value={query}
                onChange={e => setCronQuery(e.target.value)}
                rows={2}
                style={{ fontSize: 11, resize: 'vertical' }}
              />
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <label style={{ fontSize: 10, color: 'var(--text-muted)', flexShrink: 0 }}>Every</label>
                <input type="number" min={5} max={10080} value={interval}
                  onChange={e => setInterval(e.target.value)}
                  className="persona-select" style={{ width: 64, fontSize: 11 }} />
                <label style={{ fontSize: 10, color: 'var(--text-muted)' }}>min</label>
              </div>
              <button className="skill-btn" disabled={adding || !label.trim() || !query.trim()} onClick={handleAdd}
                style={{ justifyContent: 'center', fontSize: 11 }}>
                {adding ? 'Scheduling…' : '+ Schedule Scan'}
              </button>
            </div>
          ) : (
            <p className="file-meta" style={{ textAlign: 'center' }}>Upload a file first</p>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── SessionHistory ─── */
function SessionHistory({ history, currentId, onResume, onDelete }) {
  if (!history.length) return null

  const relativeTime = (iso) => {
    try {
      const diff = Date.now() - new Date(iso).getTime()
      const mins = Math.floor(diff / 60000)
      if (mins < 1)   return 'Just now'
      if (mins < 60)  return `${mins}m ago`
      const hrs = Math.floor(mins / 60)
      if (hrs < 24)   return `${hrs}h ago`
      const days = Math.floor(hrs / 24)
      if (days < 7)   return `${days}d ago`
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } catch { return '' }
  }

  const typeLabel = (t) => ({ PDF: 'PDF', CSV: 'CSV', LOG: 'Log' })[t] || t

  const summaryLine = (s) => {
    const m = s.auto_insights?.metrics
    if (!m) return `${s.chunks} chunks indexed`
    const parts = []
    if (m.critical > 0) parts.push(`${m.critical} critical`)
    if (m.errors   > 0) parts.push(`${m.errors} errors`)
    if (m.warnings > 0) parts.push(`${m.warnings} warnings`)
    if (m.rows)         parts.push(`${m.rows} rows`)
    if (m.columns)      parts.push(`${m.columns} cols`)
    return parts.length ? parts.join(' · ') : `${s.chunks} chunks`
  }

  return (
    <div className="session-history">
      <p className="section-label">Recent Sessions</p>
      <div className="session-list">
        {history.map(s => {
          const active = s.session_id === currentId
          return (
            <div
              key={s.session_id}
              className={`session-item${active ? ' active' : ''}`}
              onClick={() => onResume(s)}
            >
              <div className="session-item-left">
                {active && <div className="session-active-bar" />}
                <div className="session-body">
                  <div className="session-title">{s.filename.replace(/\.[^.]+$/, '')}</div>
                  <div className="session-meta">
                    <span className="session-type">{typeLabel(s.file_type)}</span>
                    <span className="session-dot" />
                    <span className="session-summary">{summaryLine(s)}</span>
                  </div>
                  <div className="session-time">{relativeTime(s.created_at)}</div>
                </div>
              </div>
              <button
                className="session-delete"
                onClick={e => { e.stopPropagation(); onDelete(s.session_id) }}
                title="Delete"
              ><Icon.X /></button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ─── App ─── */
export default function App() {
  const [session, setSession]           = useState(null)
  const [messages, setMessages]         = useState([])
  const [isUploading, setIsUploading]   = useState(false)
  const [isQuerying, setIsQuerying]     = useState(false)
  const [error, setError]               = useState(null)
  const [input, setInput]               = useState('')
  const [persona, setPersona]           = useState('sre')
  const [feedbacks, setFeedbacks]       = useState({})
  const [alertBanner, setAlertBanner]   = useState(null)
  const [followUps, setFollowUps]       = useState([])
  const [queryCount, setQueryCount]     = useState(0)
  const [sessionHistory, setSessionHistory] = useState([])
  const [providers, setProviders]           = useState([])
  const [provider, setProvider]             = useState('groq')
  const [model, setModel]                   = useState('llama-3.3-70b-versatile')
  const [cronJobs, setCronJobs]             = useState([])

  const messagesEndRef = useRef(null)
  const textareaRef    = useRef(null)
  const uploadInputRef = useRef(null)
  const criticalFired  = useRef(false)

  /* Load session history + providers + cron jobs on mount */
  useEffect(() => {
    fetch(`${API_BASE}/sessions`).then(r => r.json()).then(d => setSessionHistory(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE}/providers`).then(r => r.json()).then(d => setProviders(Array.isArray(d) ? d : [])).catch(() => {})
    fetch(`${API_BASE}/cron`).then(r => r.json()).then(d => setCronJobs(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  /* Cron handlers */
  const addCronJob = async ({ label, query, interval_minutes }) => {
    if (!session) return
    try {
      const res = await fetch(`${API_BASE}/cron`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.session_id, label, query, persona, provider, model, interval_minutes }),
      })
      if (!res.ok) return
      const job = await res.json()
      setCronJobs(prev => [job, ...prev])
    } catch {}
  }

  const deleteCronJob = async (jobId) => {
    try { await fetch(`${API_BASE}/cron/${jobId}`, { method: 'DELETE' }) } catch {}
    setCronJobs(prev => prev.filter(j => j.id !== jobId))
  }

  const toggleCronJob = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/cron/${jobId}/toggle`, { method: 'PATCH' })
      if (!res.ok) return
      const { enabled } = await res.json()
      setCronJobs(prev => prev.map(j => j.id === jobId ? { ...j, enabled: enabled ? 1 : 0 } : j))
    } catch {}
  }

  /* When provider changes, reset model to that provider's default */
  const currentProviderPreset = providers.find(p => p.id === provider)
  const handleProviderChange = (pid) => {
    setProvider(pid)
    const preset = providers.find(p => p.id === pid)
    if (preset) setModel(preset.default_model)
  }


  /* Auto-scroll */
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages])

  /* Textarea auto-resize */
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [input])

  /* Keyboard shortcuts */
  useEffect(() => {
    const handler = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key === 'k') { e.preventDefault(); textareaRef.current?.focus() }
      if (mod && e.key === 'u') { e.preventDefault(); uploadInputRef.current?.click() }
      if (mod && e.key === 'e') { e.preventDefault(); exportMarkdown() }
      if (e.key === 'Escape')   { setAlertBanner(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [messages, session])

  /* Export to Markdown */
  const exportMarkdown = () => {
    if (!messages.length) return
    const lines = [`# Debugr Analysis — ${session?.filename || 'Session'}`, `*${new Date().toLocaleString()}*`, '', '---', '']
    for (const m of messages) {
      lines.push(`**${m.role === 'user' ? 'You' : 'Debugr AI'}:**`)
      lines.push(m.content, '', '---', '')
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `debugr-${session?.filename || 'analysis'}.md`; a.click()
    URL.revokeObjectURL(url)
  }

  /* Upload */
  /* Resume a past session */
  const resumeSession = (s) => {
    setSession(s)
    setMessages([{ role: 'assistant', content: `**${s.filename}** resumed. Type: **${s.file_type}** · **${s.chunks}** chunks ready.\n\nAsk me anything about this file.` }])
    setInput(''); setFollowUps([]); setAlertBanner(null); setFeedbacks({})
    setQueryCount(0); criticalFired.current = false; setError(null)
  }

  /* Delete a session from history */
  const deleteFromHistory = async (sid) => {
    try { await fetch(`${API_BASE}/session/${sid}`, { method: 'DELETE' }) } catch {}
    setSessionHistory(prev => prev.filter(s => s.session_id !== sid))
    if (session?.session_id === sid) {
      setSession(null); setMessages([]); setInput(''); setFollowUps([])
      setAlertBanner(null); setFeedbacks({}); setQueryCount(0); criticalFired.current = false
    }
  }

  /* Upload */
  const handleUpload = async (file) => {
    setIsUploading(true); setError(null); setMessages([]); setSession(null)
    setInput(''); setFollowUps([]); setAlertBanner(null); setFeedbacks({})
    setQueryCount(0); criticalFired.current = false

    try {
      const form = new FormData(); form.append('file', file)
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: form })
      if (!res.ok) throw new Error((await res.text()) || 'Upload failed.')
      const data = await res.json()
      setSession(data)
      setMessages([{ role: 'assistant', content: `**${data.filename}** indexed. Type: **${data.file_type}** · **${data.chunks}** chunks ready.\n\nAsk me anything about this file.` }])
      setSessionHistory(prev => [data, ...prev.filter(s => s.session_id !== data.session_id)])
    } catch (err) {
      setError(`Upload failed: ${err.message}`)
    } finally {
      setIsUploading(false)
    }
  }

  /* Query */
  const handleQuery = async (forcedQuery) => {
    const query = (forcedQuery ?? input).trim()
    if (!query || !session || isQuerying) return
    setInput(''); setIsQuerying(true); setError(null); setFollowUps([])
    setMessages(prev => [...prev, { role: 'user', content: query }, { role: 'assistant', content: '...' }])

    try {
      const res = await fetch(`${API_BASE}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.session_id,
          query, persona, provider, model,
          cross_session_ids: sessionHistory.map(s => s.session_id),
        }),
      })
      if (!res.ok) throw new Error((await res.text()) || 'Query failed.')
      if (!res.body) throw new Error('No stream.')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let agg = '', buf = '', done = false

      while (!done) {
        const { done: d, value } = await reader.read()
        done = d
        if (value) {
          buf += decoder.decode(value, { stream: true })
          const events = buf.split('\n\n'); buf = events.pop() || ''
          for (const block of events) {
            for (const line of block.split('\n')) {
              if (!line.startsWith('data: ')) continue
              const payload = line.slice(6).trim()
              if (payload === '[DONE]') { done = true; break }
              try {
                const parsed = JSON.parse(payload)
                if (parsed.content) {
                  agg += parsed.content
                  // Check for critical keywords once
                  if (!criticalFired.current && CRITICAL_PATTERN.test(agg)) {
                    criticalFired.current = true
                    setAlertBanner('Critical indicators detected in AI response — review carefully.')
                  }
                  setMessages(prev => {
                    const u = [...prev]; u[u.length - 1] = { role: 'assistant', content: agg }; return u
                  })
                }
                if (parsed.followups) { setFollowUps(parsed.followups) }
              } catch { /* ignore partial SSE */ }
            }
          }
        }
      }
      setQueryCount(c => c + 1)
    } catch (err) {
      setError(`Query failed: ${err.message}`)
      setMessages(prev => {
        const u = [...prev]
        if (u.at(-1)?.role === 'assistant') u[u.length - 1] = { role: 'assistant', content: 'Could not complete that request. Please try again.' }
        return u
      })
    } finally {
      setIsQuerying(false)
    }
  }

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleQuery() } }

  /* Retry — re-send the last user message, drop the last AI response */
  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUserMsg || isQuerying) return
    setMessages(prev => {
      // remove last AI message
      const cut = [...prev]
      for (let i = cut.length - 1; i >= 0; i--) {
        if (cut[i].role === 'assistant') { cut.splice(i, 1); break }
      }
      return cut
    })
    handleQuery(lastUserMsg.content)
  }

  /* Edit — replace user message at index and re-run from that point */
  const handleEdit = (index, newContent) => {
    if (isQuerying) return
    // Keep messages up to (not including) the edited message, then re-query
    setMessages(prev => prev.slice(0, index))
    handleQuery(newContent)
  }

  const clearSession = async () => {
    if (session?.session_id) {
      try { await fetch(`${API_BASE}/session/${session.session_id}`, { method: 'DELETE' }) } catch {}
    }
    setSession(null); setMessages([]); setError(null); setInput(''); setIsQuerying(false)
    setFollowUps([]); setAlertBanner(null); setFeedbacks({}); setQueryCount(0); criticalFired.current = false
  }

  const typeClass = session?.file_type?.toLowerCase() || ''

  return (
    <div className="app">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon-wrap"><div className="logo-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div></div>
            <div className="logo-text-group">
              <span className="logo-wordmark">Debugr</span>
              <span className="logo-tagline">RAG · LLM · DevOps</span>
            </div>
          </div>
        </div>

        {/* Persona */}
        <div className="sidebar-section">
          <p className="section-label">Persona</p>
          <select className="persona-select" value={persona} onChange={e => setPersona(e.target.value)}>
            {PERSONAS.map(p => <option key={p.id} value={p.id}>{p.label} — {p.desc}</option>)}

          </select>
        </div>

        {/* Provider + Model */}
        <div className="sidebar-section">
          <p className="section-label">LLM Provider</p>
          <select className="persona-select" value={provider} onChange={e => handleProviderChange(e.target.value)}>
            {providers.length > 0
              ? providers.map(p => (
                  <option key={p.id} value={p.id} disabled={!p.available}>
                    {p.label}{!p.available ? ' (no API key)' : ''}
                  </option>
                ))
              : <option value="groq">Groq</option>
            }
          </select>
          <select className="persona-select" style={{ marginTop: 6 }} value={model} onChange={e => setModel(e.target.value)}>
            {(currentProviderPreset?.models ?? [{ id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' }]).map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
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
                <div className="file-status-row"><div className="pulse-dot" /><span className="file-status-text">Live session</span></div>
              </div>
              <span className={`type-pill ${typeClass}`}>{session.file_type}</span>
            </div>
            <button onClick={clearSession} className="btn-ghost-danger" style={{display:'flex',alignItems:'center',gap:5,justifyContent:'center'}}><Icon.X /> Clear session</button>
          </div>
        )}

        {/* Skills */}
        <SkillsPanel onSelect={q => { if (!isQuerying && session) handleQuery(q) }} disabled={!session || isQuerying} />

        {/* Scheduled Scans */}
        <CronPanel
          session={session}
          cronJobs={cronJobs}
          onAdd={addCronJob}
          onDelete={deleteCronJob}
          onToggle={toggleCronJob}
        />

        {/* Recent Sessions */}
        <SessionHistory
          history={sessionHistory}
          currentId={session?.session_id}
          onResume={resumeSession}
          onDelete={deleteFromHistory}
        />

        {/* Stack */}
        <div className="sidebar-footer">
          <p className="stack-header">Stack</p>
          <div className="stack-chips">
            {[currentProviderPreset?.label ?? 'Groq', 'ChromaDB', 'RAG', 'FastAPI', 'SQLite'].map(t => (
              <span key={t} className="stack-chip">{t}</span>
            ))}
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
                {session ? <><strong>{session.filename}</strong> — {PERSONAS.find(p => p.id === persona)?.label}</> : 'No file loaded'}
              </span>
            </div>
          </div>
          <div className="header-right">
            <div className="header-action-btns">
              <button className="btn-icon" title="Export to Markdown (⌘E)" onClick={exportMarkdown} disabled={!messages.length}><Icon.Download /></button>
            </div>
            <div className="model-tag">
              <div className="model-tag-dot" />
              {(currentProviderPreset?.label ?? 'Groq')} · {currentProviderPreset?.models?.find(m => m.id === model)?.label ?? model}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        {session && (
          <div className="stats-bar">
            <div className="stats-bar-item"><div className="stats-bar-dot" />{session.filename}</div>
            <div className="stats-bar-item">Type: {session.file_type}</div>
            <div className="stats-bar-item">Chunks: {session.chunks}</div>
            <div className="stats-bar-item">Queries: {queryCount}</div>
            <div className="stats-bar-item">Persona: {PERSONAS.find(p => p.id === persona)?.label}</div>
          </div>
        )}

        {/* Messages */}
        <div className="messages-area">
          {!session && messages.length === 0 && (
            <div className="hero-center">
              <HeroState onUpload={handleUpload} isUploading={isUploading} inputRef={uploadInputRef} />
            </div>
          )}

          {/* Auto-triage display on first message */}
          {session?.auto_insights?.metrics && messages.length <= 1 && (
            <AutoTriageBar metrics={session.auto_insights.metrics} fileType={session.file_type} />
          )}

          {messages.map((msg, i) => {
            const lastAIIndex = messages.reduce((acc, m, idx) => m.role === 'assistant' && m.content !== '...' ? idx : acc, -1)
            return (
              <MessageBubble
                key={`${msg.role}-${i}`}
                message={msg}
                index={i}
                feedback={feedbacks[i]}
                onFeedback={(idx, v) => setFeedbacks(f => ({ ...f, [idx]: f[idx] === v ? undefined : v }))}
                onRetry={handleRetry}
                onEdit={handleEdit}
                isLastAI={msg.role === 'assistant' && i === lastAIIndex}
                isQuerying={isQuerying}
              />
            )
          })}

          {session && messages.length === 1 && (
            <SuggestionChips fileType={session.file_type} onSelect={q => { if (!isQuerying) handleQuery(q) }} />
          )}

          <FollowUpChips chips={followUps} onSelect={q => { if (!isQuerying) handleQuery(q) }} disabled={isQuerying} />

          {alertBanner && <AlertBanner text={alertBanner} onDismiss={() => setAlertBanner(null)} />}
          {error && <div className="error-toast"><span className="error-icon"><Icon.AlertTriangle /></span>{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          <div className={`input-wrap ${!session ? 'disabled' : ''}`}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={session ? 'Ask anything about your file… (⌘K to focus)' : 'Upload a file to start analysis'}
              disabled={!session || isQuerying}
              rows={1}
              className="chat-textarea"
            />
            <button onClick={() => handleQuery()} disabled={!session || !input.trim() || isQuerying} className="send-btn" aria-label="Send">
              {isQuerying ? <div className="spinner-sm" /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
          <div className="input-footer">
            <span className="input-hint">⌘K focus · ⌘U upload · ⌘E export · Shift+Enter new line</span>
            <span className="char-count">{input.length > 0 ? input.length : ''}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
