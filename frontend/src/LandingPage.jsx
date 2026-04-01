import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Component as HorizonHero } from './components/ui/horizon-hero-section'
import './landing.css'

export default function LandingPage() {
  const navigate = useNavigate()
  const heroWrapperRef = useRef(null)
  const [heroProgress, setHeroProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)

  const goToApp = () => {
    setLeaving(true)
    setTimeout(() => navigate('/app'), 400)
  }

  // Track scroll progress ONLY within the hero zone (the 300vh sticky block)
  useEffect(() => {
    const onScroll = () => {
      const el = heroWrapperRef.current
      if (!el) return
      const { top, height } = el.getBoundingClientRect()
      // top goes from 0 → -height as we scroll through
      const scrolled = -top                      // 0 at top of hero, height at bottom
      const scrollable = height - window.innerHeight  // scrollable distance inside hero
      const progress = Math.min(Math.max(scrolled / scrollable, 0), 1)
      setHeroProgress(progress)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className={`landing-root${leaving ? ' leaving' : ''}`}>
      {/* Fixed nav */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          DEBUGR<span className="landing-nav-badge">BETA</span>
        </div>
        <div className="landing-nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#integrations">Integrations</a>
        </div>
        <button className="landing-btn-primary" onClick={goToApp}>
          Try Free →
        </button>
      </nav>

      {/* Three.js hero — 300vh scroll space, canvas + overlay both sticky */}
      <div className="hero-wrapper" ref={heroWrapperRef}>
        {/* Sticky frame holds canvas + CTA together as user scrolls */}
        <div className="hero-sticky-frame">
          <HorizonHero externalProgress={heroProgress} />

          {/* CTA overlay — inside sticky frame so it stays visible */}
          <div className="hero-cta-overlay">
            <p className="hero-cta-eyebrow">AI Incident Intelligence for DevOps Teams</p>
            <h1 className="hero-cta-title">
              Find root cause<br />in <span>seconds</span>,<br />not hours.
            </h1>
            <p className="hero-cta-sub">
              Drop a log. Ask a question.<br />
              Get cited evidence — not a wall of text.
            </p>
            <div className="hero-cta-btns">
              <button className="landing-btn-primary landing-btn-lg" onClick={goToApp}>
                Start analysing free →
              </button>
              <a className="landing-btn-ghost landing-btn-lg" href="#how">
                See how it works
              </a>
            </div>
            <div className="hero-stats">
              <div className="hero-stat"><span className="hero-stat-n">&lt;30s</span><span className="hero-stat-l">Time to root cause</span></div>
              <div className="hero-stat-div" />
              <div className="hero-stat"><span className="hero-stat-n">P1–P4</span><span className="hero-stat-l">Auto-severity triage</span></div>
              <div className="hero-stat-div" />
              <div className="hero-stat"><span className="hero-stat-n">6+</span><span className="hero-stat-l">File types supported</span></div>
              <div className="hero-stat-div" />
              <div className="hero-stat"><span className="hero-stat-n">∞</span><span className="hero-stat-l">Cross-file analysis</span></div>
            </div>
          </div>
        </div>

        {/* Scroll spacer — provides height for the Three.js camera animation */}
        <div className="hero-scroll-spacer" />
      </div>

      {/* How it works */}
      <section id="how" className="land-section land-section-light">
        <div className="land-label">How it works</div>
        <h2 className="land-title">Three steps.<br />One answer.</h2>
        <p className="land-sub">No dashboards to configure. Drop a file, ask a question, get a cited answer.</p>
        <div className="land-how-grid">
          {[
            { n:'01', title:'Upload any file', desc:'Logs, CSVs, Terraform plans, Kubernetes manifests, PDFs, CI/CD output. Single file or an entire incident\'s worth.', badge:'PDF · CSV · LOG · TXT · ENV' },
            { n:'02', title:'Ask in plain English', desc:'"What caused the spike at 02:14?" Debugr pulls the most relevant chunks from every file in context using semantic search.', badge:'Semantic RAG · Cross-file' },
            { n:'03', title:'Get a cited answer', desc:'Severity P1–P4, root cause with confidence levels, timeline, blast radius, recommendations — every claim cited to your file.', badge:'CONFIRMED · LIKELY · SUSPECTED' },
            { n:'04', title:'Iterate mid-chat', desc:'Add files mid-conversation. Edit your question. Retry. Every new file is auto-included in cross-file analysis.', badge:'Multi-file · Incident memory' },
          ].map(s => (
            <div key={s.n} className="land-how-card">
              <div className="land-step-n">{s.n}</div>
              <div className="land-step-title">{s.title}</div>
              <div className="land-step-desc">{s.desc}</div>
              <span className="land-badge">{s.badge}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="land-section land-section-dark">
        <div className="land-label" style={{color:'#E53E3E'}}>Capabilities</div>
        <h2 className="land-title" style={{color:'#fff'}}>Built for the<br />3am incident.</h2>
        <div className="land-feat-grid">
          {[
            { title:'Auto-triage on upload',      desc:'Counts critical/error/warning/memory/CPU signals the moment a file lands. No query needed.', live:true },
            { title:'Cross-file analysis',         desc:'Upload log + metrics CSV + incident PDF. Ask one question. Get an answer referencing all three.', live:true },
            { title:'P1–P4 severity classification', desc:'Every analysis outputs a severity with a specific one-sentence reason. No generic output.', live:true },
            { title:'Entity extraction pipeline',  desc:'Every response auto-extracts services, error types, deploy components — stored for pattern matching.', live:true },
            { title:'Citation validator',          desc:'Every cited timestamp verified against your source files. Hallucinations flagged before you see them.', live:true },
            { title:'Token budget management',     desc:'Large files fit to each model\'s context window. You\'re warned on truncation — analysis always completes.', live:true },
            { title:'Scheduled scans',             desc:'Hourly error checks, daily cost anomaly scans, weekly drift detection. Results in your session.', live:true },
            { title:'Multi-LLM support',           desc:'Groq, OpenAI, Together AI, or Ollama locally. Bring your own key. Switch model per query.', live:true },
            { title:'Incident memory',             desc:'Pattern match across all past incidents. "Has this service crashed before?" will have an answer.', live:false },
          ].map(f => (
            <div key={f.title} className="land-feat-card">
              <div className="land-feat-title">{f.title}</div>
              <div className="land-feat-desc">{f.desc}</div>
              <span className={`land-feat-tag ${f.live ? 'live' : ''}`}>{f.live ? 'LIVE' : 'COMING SOON'}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="land-section land-section-light">
        <div className="land-label">Integrations</div>
        <h2 className="land-title">Where your team<br />already works.</h2>
        <div className="land-int-grid">
          {[
            { name:'Groq',        desc:'Ultra-fast Llama 3.3 70B inference. Default provider.',         status:'live' },
            { name:'OpenAI',      desc:'GPT-4o and GPT-4o Mini. Bring your own API key.',               status:'live' },
            { name:'Ollama',      desc:'Run Llama, Mistral, Phi-3 fully locally. Zero data egress.',    status:'live' },
            { name:'Together AI', desc:'Open-source models at scale. Mixtral 8x7B and Llama 3 70B.',   status:'live' },
            { name:'GitHub',      desc:'PR risk scoring — Debugr comments on every pull request.',       status:'soon' },
            { name:'Slack',       desc:'/debugr command. Paste a log, get root cause without leaving Slack.', status:'soon' },
            { name:'Jira / Linear', desc:'Auto-create tickets from incidents with pre-filled root cause.', status:'soon' },
            { name:'kubectl',     desc:'debugr kubectl logs pod/order-svc — direct terminal integration.', status:'planned' },
          ].map(i => (
            <div key={i.name} className={`land-int-card ${i.status !== 'live' ? 'land-int-muted' : ''}`}>
              <div className="land-int-name">{i.name}</div>
              <div className="land-int-desc">{i.desc}</div>
              <span className={`land-int-status ${i.status}`}>
                {i.status === 'live' ? 'LIVE' : i.status === 'soon' ? 'COMING SOON' : 'PLANNED'}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="land-cta">
        <div className="land-cta-grid-bg" />
        <div className="land-cta-inner">
          <div className="land-label" style={{color:'#E53E3E'}}>Start now — free forever</div>
          <h2 className="land-cta-title">Your next 3am call<br />ends in <span>30 seconds</span>.</h2>
          <p className="land-cta-sub">Drop a log. Ask a question. Get root cause with citations — not a wall of text and a list of maybes.</p>
          <div className="hero-cta-btns">
            <button className="landing-btn-red landing-btn-lg" onClick={goToApp}>
              Start analysing free →
            </button>
            <a className="landing-btn-ghost-dark landing-btn-lg" href="#how">
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="land-footer">
        <span>© 2026 DEBUGR — AI INCIDENT INTELLIGENCE</span>
        <span>BUILT FOR ENGINEERS WHO HATE 3AM INCIDENTS</span>
        <div className="land-footer-links">
          <a href="#how">HOW IT WORKS</a>
          <a href="#features">FEATURES</a>
          <a href="#integrations">INTEGRATIONS</a>
        </div>
      </footer>
    </div>
  )
}
