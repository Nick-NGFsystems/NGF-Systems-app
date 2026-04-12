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

const SECTION_LABELS: Record<SectionId, string> = {
  hero: 'Hero Banner', about: 'About', services: 'Services',
  contact: 'Contact', brand: 'Brand & Colors', seo: 'SEO',
}

export default function WebsitePage() {
  const [content, setContent] = useState<WebsiteContent | null>(null)
  const [activeSection, setActiveSection] = useState<SectionId>('hero')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch initial content
  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        setContent(data.content as WebsiteContent)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Listen for section clicks from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sectionSelect' && e.data.section) {
        const sec = e.data.section as SectionId
        if (SECTIONS.includes(sec)) setActiveSection(sec)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Send content updates to iframe (debounced 150ms)
  const pushToPreview = useCallback((c: WebsiteContent) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 150)
  }, [])

  const update = useCallback((section: SectionId, field: string, value: string) => {
    setContent(prev => {
      if (!prev) return prev
      const next = {
        ...prev,
        [section]: { ...(prev[section] as Record<string, unknown>), [field]: value },
      }
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
      const next = {
        ...prev,
        services: [...prev.services, { id: Date.now().toString(), title: 'New Service', description: 'Describe this service' }],
      }
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
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (loading || !content) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-950">
        <div className="text-gray-400 text-sm">Loading editor...</div>
      </div>
    )
  }

  const inputCls = "w-full bg-gray-800 text-white text-sm rounded-lg px-3 py-2 border border-gray-700 focus:border-blue-500 focus:outline-none placeholder-gray-500"
  const textareaCls = `${inputCls} resize-none`
  const labelCls = "block text-gray-400 text-xs font-medium mb-1.5 uppercase tracking-wide"

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">

      {/* ── Left panel ── */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-gray-900 border-r border-gray-800">

        {/* Header */}
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <div>
            <h1 className="text-white font-semibold text-sm">Website Editor</h1>
            <p className="text-gray-500 text-xs mt-0.5">Click a section in the preview to edit</p>
          </div>
        </div>

        {/* Section tabs */}
        <div className="px-3 py-2 border-b border-gray-800 flex flex-wrap gap-1">
          {SECTIONS.map(s => (
            <button
              key={s}
              onClick={() => {
                setActiveSection(s)
                iframeRef.current?.contentWindow?.postMessage({ type: 'scrollTo', section: s }, '*')
              }}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                activeSection === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
              }`}
            >
              {SECTION_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {activeSection === 'hero' && (
            <>
              <div><label className={labelCls}>Headline</label>
                <input className={inputCls} value={content.hero.headline} onChange={e => update('hero', 'headline', e.target.value)} /></div>
              <div><label className={labelCls}>Subheadline</label>
                <textarea className={textareaCls} rows={2} value={content.hero.subheadline} onChange={e => update('hero', 'subheadline', e.target.value)} /></div>
              <div><label className={labelCls}>Button Text</label>
                <input className={inputCls} value={content.hero.ctaText} onChange={e => update('hero', 'ctaText', e.target.value)} /></div>
              <div><label className={labelCls}>Button Link</label>
                <input className={inputCls} value={content.hero.ctaLink} onChange={e => update('hero', 'ctaLink', e.target.value)} placeholder="#contact or https://..." /></div>
            </>
          )}

          {activeSection === 'about' && (
            <>
              <div><label className={labelCls}>Section Title</label>
                <input className={inputCls} value={content.about.title} onChange={e => update('about', 'title', e.target.value)} /></div>
              <div><label className={labelCls}>Body Text</label>
                <textarea className={textareaCls} rows={8} value={content.about.body} onChange={e => update('about', 'body', e.target.value)} /></div>
            </>
          )}

          {activeSection === 'services' && (
            <>
              <div className="space-y-4">
                {content.services.map((svc, idx) => (
                  <div key={svc.id} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-xs font-medium uppercase tracking-wide">Service {idx + 1}</span>
                      <button onClick={() => removeService(idx)} className="text-gray-600 hover:text-red-400 transition-colors text-xs">Remove</button>
                    </div>
                    <div className="space-y-2">
                      <input className={inputCls} value={svc.title} onChange={e => updateService(idx, 'title', e.target.value)} placeholder="Service title" />
                      <textarea className={textareaCls} rows={2} value={svc.description} onChange={e => updateService(idx, 'description', e.target.value)} placeholder="Description" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addService}
                className="w-full border border-dashed border-gray-700 hover:border-blue-500 text-gray-500 hover:text-blue-400 text-sm py-2 rounded-lg transition-colors">
                + Add Service
              </button>
            </>
          )}

          {activeSection === 'contact' && (
            <>
              {(['phone', 'email', 'address', 'hours'] as const).map(field => (
                <div key={field}>
                  <label className={labelCls}>{field}</label>
                  {field === 'address' ? (
                    <textarea className={textareaCls} rows={3} value={content.contact[field]} onChange={e => update('contact', field, e.target.value)} />
                  ) : (
                    <input className={inputCls} value={content.contact[field]} onChange={e => update('contact', field, e.target.value)} />
                  )}
                </div>
              ))}
            </>
          )}

          {activeSection === 'brand' && (
            <>
              <div><label className={labelCls}>Business Name</label>
                <input className={inputCls} value={content.brand.businessName} onChange={e => update('brand', 'businessName', e.target.value)} /></div>
              <div><label className={labelCls}>Tagline</label>
                <input className={inputCls} value={content.brand.tagline} onChange={e => update('brand', 'tagline', e.target.value)} placeholder="A short tagline" /></div>
              <div>
                <label className={labelCls}>Primary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={content.brand.primaryColor} onChange={e => update('brand', 'primaryColor', e.target.value)} className="w-10 h-9 rounded cursor-pointer border-0 bg-transparent" />
                  <input className={`${inputCls} flex-1`} value={content.brand.primaryColor} onChange={e => update('brand', 'primaryColor', e.target.value)} placeholder="#3B82F6" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Secondary Color</label>
                <div className="flex items-center gap-3">
                  <input type="color" value={content.brand.secondaryColor} onChange={e => update('brand', 'secondaryColor', e.target.value)} className="w-10 h-9 rounded cursor-pointer border-0 bg-transparent" />
                  <input className={`${inputCls} flex-1`} value={content.brand.secondaryColor} onChange={e => update('brand', 'secondaryColor', e.target.value)} placeholder="#1E40AF" />
                </div>
              </div>
            </>
          )}

          {activeSection === 'seo' && (
            <>
              <div><label className={labelCls}>Page Title</label>
                <input className={inputCls} value={content.seo.metaTitle} onChange={e => update('seo', 'metaTitle', e.target.value)} placeholder="My Business – Services & More" /></div>
              <div><label className={labelCls}>Meta Description</label>
                <textarea className={textareaCls} rows={4} value={content.seo.metaDescription} onChange={e => update('seo', 'metaDescription', e.target.value)} placeholder="A short description for search engines (150–160 chars)" /></div>
              {content.seo.metaDescription && (
                <p className={`text-xs ${content.seo.metaDescription.length > 160 ? 'text-red-400' : 'text-gray-500'}`}>
                  {content.seo.metaDescription.length} / 160 chars
                </p>
              )}
            </>
          )}

        </div>

        {/* Save bar */}
        <div className="p-3 border-t border-gray-800 flex gap-2">
          <button onClick={() => handleSave(false)} disabled={saving}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Draft'}
          </button>
          <button onClick={() => handleSave(true)} disabled={saving}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-2 rounded-lg transition-colors">
            Publish
          </button>
        </div>
      </div>

      {/* ── Right panel – live preview iframe ── */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-950">
        <iframe
          ref={iframeRef}
          src="/portal/website/preview"
          className="flex-1 w-full border-0"
          title="Website preview"
        />
      </div>

    </div>
  )
}