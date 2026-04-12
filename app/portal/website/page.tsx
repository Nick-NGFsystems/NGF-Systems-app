'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

type HeroContent = { headline: string; subheadline: string; ctaText: string; ctaLink: string }
type AboutContent = { title: string; body: string }
type ServiceItem = { title: string; description: string }
type ContactContent = { phone: string; email: string; address: string; hours: string }
type BrandContent = { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
type SeoContent = { metaTitle: string; metaDescription: string }
type ContentBlock = {
  hero?: Partial<HeroContent>; about?: Partial<AboutContent>; services?: ServiceItem[]
  contact?: Partial<ContactContent>; brand?: Partial<BrandContent>; gallery?: string[]; seo?: Partial<SeoContent>
}

type ActiveField = { section: string; field: string; value: string; label: string } | null

const fieldLabel = (section: string, field: string): string => {
  const labels: Record<string, string> = {
    'hero.headline': 'Hero Headline', 'hero.subheadline': 'Hero Subheadline',
    'hero.ctaText': 'Button Text', 'hero.ctaLink': 'Button Link',
    'about.title': 'About Title', 'about.body': 'About Text',
    'brand.businessName': 'Business Name', 'brand.tagline': 'Tagline',
    'brand.primaryColor': 'Primary Color', 'brand.secondaryColor': 'Secondary Color',
    'contact.phone': 'Phone', 'contact.email': 'Email',
    'contact.address': 'Address', 'contact.hours': 'Hours',
  }
  if (section === 'services') {
    const [idx, prop] = field.split('.')
    return `Service ${parseInt(idx) + 1} ${prop === 'title' ? 'Title' : 'Description'}`
  }
  return labels[`${section}.${field}`] ?? field
}

export default function WebsiteEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [content, setContent] = useState<ContentBlock>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeField, setActiveField] = useState<ActiveField>(null)

  /* — push content to preview ————————————————*/
  const pushToPreview = useCallback((c: ContentBlock) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  /* — update a field ——————————————————————————*/
  const update = useCallback((section: string, field: string, value: string) => {
    setContent(prev => {
      let next: ContentBlock
      if (section === 'services') {
        const [idx, prop] = field.split('.')
        const svcs = [...((prev.services as ServiceItem[]) || [])]
        svcs[parseInt(idx)] = { ...svcs[parseInt(idx)], [prop]: value }
        next = { ...prev, services: svcs }
      } else {
        next = { ...prev, [section]: { ...(prev as Record<string, unknown>)[section] as object, [field]: value } }
      }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  /* — load content ————————————————————————————*/
  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => { if (data?.content) setContent(data.content) })
      .catch(() => {})
  }, [])

  /* — listen for fieldClick from iframe ————————*/
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'fieldClick') {
        const { section, field, currentValue } = e.data
        setActiveField({ section, field, value: currentValue, label: fieldLabel(section, field) })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  /* — save ————————————————————————————————————*/
  const save = async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/portal/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
    } catch { setSaveStatus('error') }
    setTimeout(() => setSaveStatus('idle'), 2500)
  }

  const businessName = (content.brand as BrandContent)?.businessName || 'Website Editor'

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      {/* Top toolbar */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 flex-shrink-0 z-10">
        <span className="font-semibold text-gray-800 text-sm truncate max-w-xs">{businessName}</span>
        <div className="flex items-center gap-3">
          {saveStatus === 'saving' && <span className="text-xs text-gray-400">Saving…</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-600">Saved</span>}
          {saveStatus === 'error' && <span className="text-xs text-red-500">Error saving</span>}
          {saveStatus === 'idle' && <span className="text-xs text-gray-400">Click any text to edit</span>}
          <button
            onClick={save}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative overflow-hidden">
        <iframe
          ref={iframeRef}
          src="/preview"
          className="w-full h-full border-0"
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage({ type: 'setEditMode', enabled: true }, '*')
          }}
        />

        {/* Floating edit popover */}
        {activeField && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-4 w-[420px] max-w-[calc(100vw-2rem)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{activeField.label}</span>
              <button
                onClick={() => setActiveField(null)}
                className="text-gray-400 hover:text-gray-700 text-lg leading-none w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
              >
                ×
              </button>
            </div>
            <textarea
              autoFocus
              rows={activeField.field.includes('body') || activeField.field.includes('description') ? 4 : 2}
              value={activeField.value}
              onChange={e => {
                const val = e.target.value
                setActiveField(prev => prev ? { ...prev, value: val } : null)
                update(activeField.section, activeField.field, val)
              }}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={`Enter ${activeField.label.toLowerCase()}…`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
