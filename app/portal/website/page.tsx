'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ServiceItem { id: string; title: string; description: string }
interface WebsiteContent {
  hero: { headline: string; subheadline: string; ctaText: string; ctaLink: string }
  about: { title: string; body: string }
  services: ServiceItem[]
  contact: { phone: string; email: string; address: string; hours: string }
  brand: { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
  gallery: string[]
  seo: { metaTitle: string; metaDescription: string }
}

const SECTIONS = ['hero', 'about', 'services', 'contact', 'brand', 'seo'] as const
type SectionId = typeof SECTIONS[number]

const SECTION_META: Record<SectionId, { label: string; icon: string }> = {
  hero:     { label: 'Hero Banner',    icon: '✦' },
  about:    { label: 'About',          icon: '◎' },
  services: { label: 'Services',       icon: '⬡' },
  contact:  { label: 'Contact',        icon: '◉' },
  brand:    { label: 'Brand & Colors', icon: '◈' },
  seo:      { label: 'SEO',            icon: '◑' },
}

export default function WebsitePage() {
  const [content, setContent]               = useState<WebsiteContent | null>(null)
  const [activeSection, setActiveSection]   = useState<SectionId | null>(null)
  const [panelVisible, setPanelVisible]     = useState(false)
  const [saving, setSaving]                 = useState(false)
  const [saved, setSaved]                   = useState(false)
  const [loading, setLoading]               = useState(true)
  const iframeRef  = useRef<HTMLIFrameElement>(null)
  const sendTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => { setContent(data.content as WebsiteContent); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sectionSelect') {
        const sec = e.data.section as SectionId | null
        if (sec && SECTIONS.includes(sec)) {
          if (closeTimer.current) clearTimeout(closeTimer.current)
          setActiveSection(sec)
          requestAnimationFrame(() => setPanelVisible(true))
        } else {
          // clicking outside a section closes the panel
          setPanelVisible(false)
          closeTimer.current = setTimeout(() => setActiveSection(null), 360)
        }
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const pushToPreview = useCallback((c: WebsiteContent) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  const update = useCallback((section: SectionId, field: string, value: string) => {
    setContent(prev => {
      if (!prev) return prev
      const next = { ...prev, [section]: { ...(prev[section] as Record<string, unknown>), [field]: value } }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const updateService = useCallback((idx: number, field: 'title' | 'description', value: string) => {
    setContent(prev => {
      if (!prev) return prev
      const services = prev.services.map((s, i) => i === idx ? { ...s, [field]: value } : s)
      const next = { ...prev, services }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const addService = useCallback(() => {
    setContent(prev => {
      if (!prev) return prev
      const next = { ...prev, services: [...prev.services, { id: Date.now().toString(), title: 'New Service', description: 'Describe this service' }] }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const removeService = useCallback((idx: number) => {
    setContent(prev => {
      if (!prev) return prev
      const next = { ...prev, services: prev.services.filter((_, i) => i !== idx) }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const handleSave = async (publish = false) => {
    if (!content) return
    setSaving(true)
    try {
      await fetch('/api/portal/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, publish }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  const closePanel = () => {
    setPanelVisible(false)
    closeTimer.current = setTimeout(() => setActiveSection(null), 360)
  }

  const switchSection = (s: SectionId) => {
    setActiveSection(s)
    iframeRef.current?.contentWindow?.postMessage({ type: 'scrollTo', section: s }, '*')
  }

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#0a0a0f' }}>
        <div className="text-white/40 text-sm tracking-wide">Loading…</div>
      </div>
    )
  }

  const ic = "w-full text-white text-sm rounded-xl px-3 py-2.5 border focus:outline-none placeholder-white/20 transition-colors"
    + " bg-white/5 border-white/10 focus:border-white/30 focus:bg-white/8"
  const ta = ic + " resize-none"
  const lb = "block text-white/40 text-xs font-medium mb-1.5 uppercase tracking-widest"

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black">

      {/* ── Full-screen preview iframe ── */}
      <iframe
        ref={iframeRef}
        src="/portal/website/preview"
        className="absolute inset-0 w-full h-full border-0"
        title="Website preview"
      />

      {/* ── Top toolbar (minimal, fades into page) ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 100%)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white/30" />
          <span className="text-white/60 text-xs font-medium tracking-wide select-none">Website Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-white/70 transition-all disabled:opacity-30 hover:text-white"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-all disabled:opacity-30 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)', border: '1px solid rgba(255,255,255,0.15)' }}>
            Publish
          </button>
        </div>
      </div>

      {/* ── Floating glass edit panel ── */}
      {activeSection && content && (() => {
        const meta = SECTION_META[activeSection]
        const hero = content.hero
        const about = content.about
        const contact = content.contact
        const brand = content.brand
        const seo = content.seo

        return (
          <div
            className="absolute bottom-0 left-0 right-0 z-30 flex justify-center pb-5 px-4 pointer-events-none"
            style={{ transition: 'opacity 0.25s ease', opacity: panelVisible ? 1 : 0 }}
          >
            <div
              className="w-full max-w-2xl rounded-2xl overflow-hidden pointer-events-auto"
              style={{
                transform: panelVisible ? 'translateY(0) scale(1)' : 'translateY(32px) scale(0.97)',
                transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                background: 'rgba(10,10,18,0.80)',
                backdropFilter: 'blur(32px) saturate(180%)',
                WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)',
              }}
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-3"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="text-white/50 text-base leading-none">{meta.icon}</span>
                  <span className="text-white font-semibold text-sm">{meta.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Section switcher pills */}
                  <div className="flex gap-1 mr-3">
                    {SECTIONS.map(s => (
                      <button key={s} onClick={() => switchSection(s)}
                        title={SECTION_META[s].label}
                        className="w-6 h-6 rounded-md text-xs flex items-center justify-center transition-all"
                        style={{
                          background: activeSection === s ? 'rgba(99,102,241,0.35)' : 'rgba(255,255,255,0.06)',
                          color: activeSection === s ? '#a5b4fc' : 'rgba(255,255,255,0.35)',
                          border: activeSection === s ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        }}>
                        {SECTION_META[s].icon}
                      </button>
                    ))}
                  </div>
                  <button onClick={closePanel}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    ✕
                  </button>
                </div>
              </div>

              {/* Fields */}
              <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto custom-scroll">

                {activeSection === 'hero' && (
                  <>
                    <div><label className={lb}>Headline</label>
                      <input className={ic} value={hero.headline} onChange={e => update('hero','headline',e.target.value)} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lb}>Button Text</label>
                        <input className={ic} value={hero.ctaText} onChange={e => update('hero','ctaText',e.target.value)} /></div>
                      <div><label className={lb}>Button Link</label>
                        <input className={ic} value={hero.ctaLink} onChange={e => update('hero','ctaLink',e.target.value)} placeholder="#contact" /></div>
                    </div>
                    <div><label className={lb}>Subheadline</label>
                      <textarea className={ta} rows={2} value={hero.subheadline} onChange={e => update('hero','subheadline',e.target.value)} /></div>
                  </>
                )}

                {activeSection === 'about' && (
                  <>
                    <div><label className={lb}>Section Title</label>
                      <input className={ic} value={about.title} onChange={e => update('about','title',e.target.value)} /></div>
                    <div><label className={lb}>Body</label>
                      <textarea className={ta} rows={5} value={about.body} onChange={e => update('about','body',e.target.value)} /></div>
                  </>
                )}

                {activeSection === 'services' && (
                  <>
                    <div className="space-y-3">
                      {content.services.map((svc, idx) => (
                        <div key={svc.id} className="rounded-xl p-3" style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-white/40 text-xs uppercase tracking-widest">Service {idx+1}</span>
                            <button onClick={() => removeService(idx)} className="text-xs text-white/20 hover:text-red-400 transition-colors">remove</button>
                          </div>
                          <div className="space-y-2">
                            <input className={ic} value={svc.title} onChange={e => updateService(idx,'title',e.target.value)} placeholder="Title" />
                            <textarea className={ta} rows={2} value={svc.description} onChange={e => updateService(idx,'description',e.target.value)} placeholder="Description" />
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={addService}
                      className="w-full py-2 rounded-xl text-sm text-white/40 hover:text-white/70 transition-colors"
                      style={{ border:'1px dashed rgba(255,255,255,0.12)' }}>
                      + Add Service
                    </button>
                  </>
                )}

                {activeSection === 'contact' && (
                  <div className="grid grid-cols-2 gap-3">
                    {(['phone','email','hours'] as const).map(field => (
                      <div key={field}><label className={lb}>{field}</label>
                        <input className={ic} value={contact[field]} onChange={e => update('contact',field,e.target.value)} /></div>
                    ))}
                    <div className="col-span-2"><label className={lb}>Address</label>
                      <textarea className={ta} rows={2} value={contact.address} onChange={e => update('contact','address',e.target.value)} /></div>
                  </div>
                )}

                {activeSection === 'brand' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lb}>Business Name</label>
                        <input className={ic} value={brand.businessName} onChange={e => update('brand','businessName',e.target.value)} /></div>
                      <div><label className={lb}>Tagline</label>
                        <input className={ic} value={brand.tagline} onChange={e => update('brand','tagline',e.target.value)} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={lb}>Primary Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={brand.primaryColor} onChange={e => update('brand','primaryColor',e.target.value)}
                            className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent flex-shrink-0" />
                          <input className={`${ic} flex-1`} value={brand.primaryColor} onChange={e => update('brand','primaryColor',e.target.value)} />
                        </div>
                      </div>
                      <div><label className={lb}>Secondary Color</label>
                        <div className="flex items-center gap-2">
                          <input type="color" value={brand.secondaryColor} onChange={e => update('brand','secondaryColor',e.target.value)}
                            className="w-9 h-9 rounded-lg cursor-pointer border-0 bg-transparent flex-shrink-0" />
                          <input className={`${ic} flex-1`} value={brand.secondaryColor} onChange={e => update('brand','secondaryColor',e.target.value)} />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === 'seo' && (
                  <>
                    <div><label className={lb}>Page Title</label>
                      <input className={ic} value={seo.metaTitle} onChange={e => update('seo','metaTitle',e.target.value)} placeholder="Business Name – tagline" /></div>
                    <div><label className={lb}>Meta Description</label>
                      <textarea className={ta} rows={3} value={seo.metaDescription} onChange={e => update('seo','metaDescription',e.target.value)} placeholder="150–160 characters for search engines" />
                      {seo.metaDescription && (
                        <p className={`text-xs mt-1 ${seo.metaDescription.length > 160 ? 'text-red-400' : 'text-white/30'}`}>
                          {seo.metaDescription.length}/160
                        </p>
                      )}
                    </div>
                  </>
                )}

              </div>

              {/* Bottom save bar */}
              <div className="flex items-center gap-2 px-5 py-3"
                style={{ borderTop:'1px solid rgba(255,255,255,0.07)' }}>
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-white/60 hover:text-white transition-all disabled:opacity-30"
                  style={{ background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.09)' }}>
                  {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Draft'}
                </button>
                <button onClick={() => handleSave(true)} disabled={saving}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all disabled:opacity-30"
                  style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', border:'1px solid rgba(255,255,255,0.15)' }}>
                  Publish
                </button>
              </div>

            </div>
          </div>
        )
      })()}

    </div>
  )
}