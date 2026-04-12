'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface ServiceItem {
  id: string
  title: string
  description: string
}

interface ContentBlock {
  hero:     { headline: string; subheadline: string; ctaText: string; ctaLink: string }
  about:    { title: string; body: string }
  services: ServiceItem[]
  contact:  { phone: string; email: string; address: string; hours: string }
  brand:    { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
  seo:      { metaTitle: string; metaDescription: string }
}

interface WebsiteData {
  id: string
  content: ContentBlock
  published_at: string | null
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

const DEFAULT_CONTENT: ContentBlock = {
  hero:     { headline: 'Welcome', subheadline: 'We provide excellent services', ctaText: 'Get In Touch', ctaLink: '#contact' },
  about:    { title: 'About Us', body: 'Tell your story here...' },
  services: [
    { id: '1', title: 'Service One',   description: 'Describe your first service'  },
    { id: '2', title: 'Service Two',   description: 'Describe your second service' },
    { id: '3', title: 'Service Three', description: 'Describe your third service'  },
  ],
  contact:  { phone: '', email: '', address: '', hours: 'Mon-Fri 9am-5pm' },
  brand:    { businessName: '', tagline: '', primaryColor: '#3B82F6', secondaryColor: '#1E40AF' },
  seo:      { metaTitle: '', metaDescription: '' },
}

/* ── Apple Liquid Glass styles ───────────────────────────────────── */
const glass = {
  panel: {
    background: 'linear-gradient(145deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)',
    backdropFilter: 'blur(48px) saturate(220%) brightness(1.08)',
    WebkitBackdropFilter: 'blur(48px) saturate(220%) brightness(1.08)',
    border: '1px solid rgba(255,255,255,0.28)',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '32px',
    boxShadow: [
      'inset 0 1.5px 0 rgba(255,255,255,0.45)',
      'inset 0 -1px 0 rgba(0,0,0,0.12)',
      '0 32px 80px rgba(0,0,0,0.45)',
      '0 0 0 0.5px rgba(255,255,255,0.08)',
    ].join(', '),
  } as React.CSSProperties,
  pill: {
    background: 'rgba(255,255,255,0.12)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.22)',
    borderRadius: '999px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 4px 20px rgba(0,0,0,0.3)',
  } as React.CSSProperties,
  input: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '12px',
    color: '#fff',
    outline: 'none',
  } as React.CSSProperties,
  sectionPill: {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
  } as React.CSSProperties,
  sectionPillActive: {
    background: 'rgba(255,255,255,0.22)',
    border: '1px solid rgba(255,255,255,0.35)',
    borderRadius: '999px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)',
  } as React.CSSProperties,
}

export default function WebsitePage() {
  const [data, setData]                   = useState<WebsiteData | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId | null>(null)
  const [panelVisible, setPanelVisible]   = useState(false)
  const [saving, setSaving]               = useState(false)
  const [saveStatus, setSaveStatus]       = useState<'idle' | 'saved' | 'error'>('idle')
  const [loading, setLoading]             = useState(true)

  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const sendTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* ── fetch ─────────────────────────────────────────────────────── */
  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then((d: WebsiteData) => { setData(d); setLoading(false) })
      .catch(() => { setData({ id: '', content: DEFAULT_CONTENT, published_at: null }); setLoading(false) })
  }, [])

  /* ── postMessage from preview ───────────────────────────────────── */
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sectionSelect') {
        const id = e.data.sectionId as SectionId
        if (SECTIONS.includes(id)) openSection(id)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  /* ── push content to preview ────────────────────────────────────── */
  const pushToPreview = useCallback((content: ContentBlock) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content }, '*')
    }, 120)
  }, [])

  /* ── update field ───────────────────────────────────────────────── */
  const update = useCallback((section: SectionId, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev
      const next = { ...prev, content: { ...prev.content, [section]: { ...(prev.content[section] as Record<string, unknown>), [field]: value } } }
      pushToPreview(next.content)
      return next
    })
  }, [pushToPreview])

  const updateService = useCallback((idx: number, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev
      const services = prev.content.services.map((s, i) => i === idx ? { ...s, [field]: value } : s)
      const next = { ...prev, content: { ...prev.content, services } }
      pushToPreview(next.content)
      return next
    })
  }, [pushToPreview])

  const addService = useCallback(() => {
    setData(prev => {
      if (!prev) return prev
      const services = [...prev.content.services, { id: String(Date.now()), title: 'New Service', description: '' }]
      const next = { ...prev, content: { ...prev.content, services } }
      pushToPreview(next.content)
      return next
    })
  }, [pushToPreview])

  const removeService = useCallback((idx: number) => {
    setData(prev => {
      if (!prev) return prev
      const services = prev.content.services.filter((_, i) => i !== idx)
      const next = { ...prev, content: { ...prev.content, services } }
      pushToPreview(next.content)
      return next
    })
  }, [pushToPreview])

  /* ── save ───────────────────────────────────────────────────────── */
  const save = useCallback(async (publish = false) => {
    if (!data) return
    setSaving(true)
    try {
      const r = await fetch('/api/portal/website', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: data.content, publish }),
      })
      if (!r.ok) throw new Error()
      const updated: WebsiteData = await r.json()
      setData(updated)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2200)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } finally {
      setSaving(false)
    }
  }, [data])

  /* ── panel open/close ───────────────────────────────────────────── */
  const openSection = useCallback((id: SectionId) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    setActiveSection(id)
    setPanelVisible(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setPanelVisible(true)))
    // scroll preview to section
    iframeRef.current?.contentWindow?.postMessage({ type: 'scrollTo', sectionId: id }, '*')
  }, [])

  const closePanel = useCallback(() => {
    setPanelVisible(false)
    closeTimer.current = setTimeout(() => setActiveSection(null), 380)
  }, [])

  if (loading) return (
    <div className="flex h-screen w-full items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <p className="text-sm text-white/50">Loading editor…</p>
      </div>
    </div>
  )

  const content = data!.content

  return (
    <div className="relative h-screen w-full overflow-hidden bg-black"
         onClick={() => activeSection && closePanel()}>

      {/* ── Full-screen preview iframe ── */}
      <iframe
        ref={iframeRef}
        src="/portal/website/preview"
        className="absolute inset-0 h-full w-full border-0"
        style={{ pointerEvents: activeSection ? 'none' : 'auto' }}
      />

      {/* ── Top toolbar — pointer-events ONLY on buttons, not the gradient ── */}
      <div
        className="absolute inset-x-0 top-0 z-30 flex items-start justify-end gap-2 px-5 py-4"
        style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.60) 0%, transparent 100%)', pointerEvents: 'none' }}
      >
        <button
          onClick={e => { e.stopPropagation(); save(false) }}
          disabled={saving}
          style={{ ...glass.pill, pointerEvents: 'auto', color: '#fff', fontSize: '13px', fontWeight: 500, padding: '7px 16px', cursor: 'pointer' }}
        >
          {saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✕ Error' : saving ? 'Saving…' : 'Save Draft'}
        </button>
        <button
          onClick={e => { e.stopPropagation(); save(true) }}
          disabled={saving}
          style={{
            pointerEvents: 'auto',
            background: 'linear-gradient(135deg,rgba(99,102,241,0.9) 0%,rgba(79,70,229,0.9) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.20)',
            borderRadius: '999px',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 4px 20px rgba(79,70,229,0.45)',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            padding: '7px 18px',
            cursor: 'pointer',
          }}
        >
          Publish
        </button>
      </div>

      {/* ── Section hint bar (shown when no panel open) ── */}
      {!activeSection && (
        <div
          className="absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1.5 px-4 py-2"
          style={{ ...glass.pill, pointerEvents: 'none' }}
          onClick={e => e.stopPropagation()}
        >
          <span className="text-xs text-white/50 mr-1">Click a section to edit</span>
          {SECTIONS.map(id => (
            <button
              key={id}
              onClick={e => { e.stopPropagation(); openSection(id) }}
              style={{ ...glass.sectionPill, pointerEvents: 'auto', color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 500, padding: '4px 10px', cursor: 'pointer', border: 'none' }}
            >
              {SECTION_META[id].icon} {SECTION_META[id].label}
            </button>
          ))}
        </div>
      )}

      {/* ── Floating glass edit panel — always bottom-center, always in viewport ── */}
      {activeSection && (
        <div
          className="absolute bottom-6 left-1/2 z-40 w-[520px] max-w-[calc(100vw-32px)]"
          style={{
            ...glass.panel,
            transform: `translateX(-50%) translateY(${panelVisible ? '0px' : '28px'}) scale(${panelVisible ? 1 : 0.96})`,
            opacity: panelVisible ? 1 : 0,
            transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.28s ease',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* ── Panel header ── */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{SECTION_META[activeSection].icon}</span>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '15px', flex: 1 }}>
              {SECTION_META[activeSection].label}
            </span>
            {/* Section switcher pills */}
            <div className="flex gap-1">
              {SECTIONS.map(id => (
                <button
                  key={id}
                  onClick={() => openSection(id)}
                  title={SECTION_META[id].label}
                  style={{
                    ...(id === activeSection ? glass.sectionPillActive : glass.sectionPill),
                    color: id === activeSection ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontSize: '13px',
                    padding: '4px 8px',
                    cursor: 'pointer',
                    border: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {SECTION_META[id].icon}
                </button>
              ))}
            </div>
            {/* Close */}
            <button
              onClick={closePanel}
              style={{ color: 'rgba(255,255,255,0.45)', fontSize: '18px', lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', padding: '2px 6px', borderRadius: '8px' }}
            >
              ✕
            </button>
          </div>

          {/* thin divider */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.10)', margin: '0 20px' }} />

          {/* ── Fields ── */}
          <div className="px-5 py-4 space-y-4">
            {activeSection === 'hero' && <>
              <GlassField label="Headline"    value={content.hero.headline}    onChange={v => update('hero','headline',v)} />
              <GlassField label="Subheadline" value={content.hero.subheadline} onChange={v => update('hero','subheadline',v)} />
              <GlassField label="CTA Text"    value={content.hero.ctaText}     onChange={v => update('hero','ctaText',v)} />
              <GlassField label="CTA Link"    value={content.hero.ctaLink}     onChange={v => update('hero','ctaLink',v)} />
            </>}
            {activeSection === 'about' && <>
              <GlassField label="Title" value={content.about.title} onChange={v => update('about','title',v)} />
              <GlassField label="Body"  value={content.about.body}  onChange={v => update('about','body',v)} textarea />
            </>}
            {activeSection === 'services' && <>
              {content.services.map((s, i) => (
                <div key={s.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.10)', padding: '14px' }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Service {i + 1}</span>
                    <button onClick={() => removeService(i)} style={{ color: 'rgba(255,100,100,0.7)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>✕ Remove</button>
                  </div>
                  <GlassField label="Title"       value={s.title}       onChange={v => updateService(i,'title',v)} />
                  <div className="mt-3">
                    <GlassField label="Description" value={s.description} onChange={v => updateService(i,'description',v)} />
                  </div>
                </div>
              ))}
              <button
                onClick={addService}
                style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.06)', border: '1px dashed rgba(255,255,255,0.20)', borderRadius: '14px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', cursor: 'pointer' }}
              >
                + Add Service
              </button>
            </>}
            {activeSection === 'contact' && <>
              <GlassField label="Phone"   value={content.contact.phone}   onChange={v => update('contact','phone',v)} />
              <GlassField label="Email"   value={content.contact.email}   onChange={v => update('contact','email',v)} />
              <GlassField label="Address" value={content.contact.address} onChange={v => update('contact','address',v)} />
              <GlassField label="Hours"   value={content.contact.hours}   onChange={v => update('contact','hours',v)} />
            </>}
            {activeSection === 'brand' && <>
              <GlassField label="Business Name" value={content.brand.businessName} onChange={v => update('brand','businessName',v)} />
              <GlassField label="Tagline"        value={content.brand.tagline}       onChange={v => update('brand','tagline',v)} />
              <GlassColorField label="Primary Color"   value={content.brand.primaryColor}   onChange={v => update('brand','primaryColor',v)} />
              <GlassColorField label="Secondary Color" value={content.brand.secondaryColor} onChange={v => update('brand','secondaryColor',v)} />
            </>}
            {activeSection === 'seo' && <>
              <GlassField label="Meta Title"       value={content.seo.metaTitle}       onChange={v => update('seo','metaTitle',v)} />
              <GlassField label="Meta Description" value={content.seo.metaDescription} onChange={v => update('seo','metaDescription',v)} textarea />
            </>}
          </div>

          {/* ── Save bar ── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 20px', display: 'flex', gap: '10px' }}>
            <button
              onClick={() => save(false)}
              disabled={saving}
              style={{ flex: 1, padding: '9px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '14px', color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}
            >
              {saveStatus === 'saved' ? '✓ Draft Saved' : 'Save Draft'}
            </button>
            <button
              onClick={() => save(true)}
              disabled={saving}
              style={{ flex: 1, padding: '9px', background: 'linear-gradient(135deg,rgba(99,102,241,0.85) 0%,rgba(79,70,229,0.85) 100%)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: '14px', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
            >
              Publish
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Glass form primitives ─────────────────────────────────────────── */
function GlassField({ label, value, onChange, textarea = false }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean
}) {
  const base: React.CSSProperties = {
    width: '100%', padding: '9px 12px',
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '12px', color: '#fff', fontSize: '13px',
    outline: 'none', boxSizing: 'border-box',
    fontFamily: 'inherit',
  }
  return (
    <div>
      <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </label>
      {textarea
        ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={3} style={{ ...base, resize: 'vertical' }} />
        : <input    value={value} onChange={e => onChange(e.target.value)} style={base} />
      }
    </div>
  )
}

function GlassColorField({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void
}) {
  return (
    <div>
      <label style={{ display: 'block', color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: '6px' }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: '44px', height: '36px', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', cursor: 'pointer', background: 'none', padding: '2px' }} />
        <input value={value} onChange={e => onChange(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', color: '#fff', fontSize: '13px', outline: 'none', fontFamily: 'monospace', boxSizing: 'border-box' }} />
      </div>
    </div>
  )
}