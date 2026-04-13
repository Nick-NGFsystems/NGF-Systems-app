'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ServiceItem { id: string; title: string; description: string }

interface ContentBlock {
  hero: { headline: string; subheadline: string; ctaText: string; ctaLink: string }
  about: { title: string; body: string }
  services: ServiceItem[]
  contact: { phone: string; email: string; address: string; hours: string }
  brand: { businessName: string; tagline: string; primaryColor: string; secondaryColor: string }
  gallery: string[]
  seo: { metaTitle: string; metaDescription: string }
}

type Section = 'hero' | 'about' | 'services' | 'contact' | 'brand' | 'seo'

const FIELD_LABELS: Record<string, string> = {
  'hero.headline': 'Headline', 'hero.subheadline': 'Subheadline',
  'hero.ctaText': 'Button Text', 'hero.ctaLink': 'Button Link',
  'about.title': 'Section Title', 'about.body': 'Body Text',
  'contact.phone': 'Phone', 'contact.email': 'Email',h
  'contact.address': 'Address', 'contact.hours': 'Hours',
  'brand.businessName': 'Business Name', 'brand.tagline': 'Tagline',
  'brand.primaryColor': 'Primary Color', 'brand.secondaryColor': 'Secondary Color',
  'seo.metaTitle': 'Meta Title', 'seo.metaDescription': 'Meta Description',
}

function fieldLabel(section: string, field: string): string {
  if (section === 'services') {
    const [idx, prop] = field.split('.')
    return `Service ${parseInt(idx) + 1} ${prop === 'title' ? 'Title' : 'Description'}`
  }
  return FIELD_LABELS[`${section}.${field}`] ?? field
}

function Field({ label, value, onChange, textarea, rows = 3 }: {
  label: string; value: string; onChange: (v: string) => void; textarea?: boolean; rows?: number
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {textarea ? (
        <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#3B82F6'} onChange={e => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-gray-200 p-0.5 bg-transparent" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono" />
      </div>
    </div>
  )
}

export default function WebsiteEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [content, setContent] = useState<ContentBlock>({} as ContentBlock)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<Section>('hero')
  const [siteUrl, setSiteUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeField, setActiveField] = useState<{ section: string; field: string; value: string; label: string } | null>(null)

  const pushToPreview = useCallback((c: ContentBlock) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  const update = useCallback((section: string, field: string, value: string) => {
    setContent(prev => {
      let next: ContentBlock
      if (section === 'services') {
        const [idx, prop] = field.split('.')
        const svcs = [...((prev.services as ServiceItem[]) || [])]
        svcs[parseInt(idx)] = { ...svcs[parseInt(idx)], [prop]: value }
        next = { ...prev, services: svcs }
      } else {
        next = { ...prev, [section]: { ...(prev as unknown as Record<string, unknown>)[section] as object, [field]: value } }
      }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const addService = useCallback(() => {
    setContent(prev => {
      const svcs = [...((prev.services as ServiceItem[]) || [])]
      svcs.push({ id: String(Date.now()), title: 'New Service', description: 'Describe this service' })
      const next = { ...prev, services: svcs }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const removeService = useCallback((idx: number) => {
    setContent(prev => {
      const svcs = [...((prev.services as ServiceItem[]) || [])]
      svcs.splice(idx, 1)
      const next = { ...prev, services: svcs }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const save = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/portal/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      setSaveStatus(res.ok ? 'saved' : 'error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 2500)
    }
  }, [content])

  useEffect(() => {
    fetch('/api/portal/website')
      .then(r => r.json())
      .then(data => {
        if (data?.content) setContent(data.content as ContentBlock)
        if (data?.site_url) setSiteUrl(data.site_url as string)
        if (data?.client_id) setClientId(data.client_id as string)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'fieldClick') {
        const { section, field, currentValue } = e.data as { section: string; field: string; currentValue: string }
        setActiveField({ section, field, value: currentValue, label: fieldLabel(section, field) })
        setActiveSection(section as Section)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading…</p>
        </div>
      </div>
    )
  }

  if (!siteUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your website is on its way</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The NGF team is building your website. Once it&apos;s live, you&apos;ll be able to edit your content right here &mdash; headlines, services, colors, and more.
          </p>
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-600 font-medium">Have questions? Reach out to your NGF account manager.</p>
          </div>
        </div>
      </div>
    )
  }

  const services = (content.services as ServiceItem[]) || []
  const previewUrl = clientId ? `/preview?clientId=${clientId}` : '/preview'
  const sections: Section[] = ['hero', 'about', 'services', 'contact', 'brand', 'seo']

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Website Editor</h2>
            <button
              onClick={save}
              disabled={saveStatus === 'saving'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                saveStatus === 'saving' ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : saveStatus === 'saved' ? 'bg-green-100 text-green-700'
                  : saveStatus === 'error' ? 'bg-red-100 text-red-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Error' : 'Save'}
            </button>
          </div>
          <a href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`} target="_blank" rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate">
            <span className="truncate">{siteUrl.replace(/^https?:\/\//, '')}</span>
            <span className="flex-shrink-0">↗</span>
          </a>
        </div>

        <div className="flex border-b border-gray-100 overflow-x-auto flex-shrink-0">
          {sections.map(s => (
            <button key={s} onClick={() => setActiveSection(s)}
              className={`px-3 py-2 text-xs font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeSection === s
                  ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {s}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeSection === 'hero' && (
            <>
              <Field label="Headline" value={content.hero?.headline ?? ''} onChange={v => update('hero', 'headline', v)} />
              <Field label="Subheadline" value={content.hero?.subheadline ?? ''} onChange={v => update('hero', 'subheadline', v)} textarea />
              <Field label="Button Text" value={content.hero?.ctaText ?? ''} onChange={v => update('hero', 'ctaText', v)} />
              <Field label="Button Link" value={content.hero?.ctaLink ?? ''} onChange={v => update('hero', 'ctaLink', v)} />
            </>
          )}
          {activeSection === 'about' && (
            <>
              <Field label="Section Title" value={content.about?.title ?? ''} onChange={v => update('about', 'title', v)} />
              <Field label="Body Text" value={content.about?.body ?? ''} onChange={v => update('about', 'body', v)} textarea rows={6} />
            </>
          )}
          {activeSection === 'services' && (
            <>
              {services.map((svc, idx) => (
                <div key={svc.id} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">Service {idx + 1}</span>
                    <button onClick={() => removeService(idx)}
                      className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">
                      Remove
                    </button>
                  </div>
                  <Field label="Title" value={svc.title} onChange={v => update('services', `${idx}.title`, v)} />
                  <Field label="Description" value={svc.description} onChange={v => update('services', `${idx}.description`, v)} textarea rows={3} />
                </div>
              ))}
              <button onClick={addService}
                className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all">
                + Add Service
              </button>
            </>
          )}
          {activeSection === 'contact' && (
            <>
              <Field label="Phone" value={content.contact?.phone ?? ''} onChange={v => update('contact', 'phone', v)} />
              <Field label="Email" value={content.contact?.email ?? ''} onChange={v => update('contact', 'email', v)} />
              <Field label="Address" value={content.contact?.address ?? ''} onChange={v => update('contact', 'address', v)} textarea rows={2} />
              <Field label="Hours" value={content.contact?.hours ?? ''} onChange={v => update('contact', 'hours', v)} />
            </>
          )}
          {activeSection === 'brand' && (
            <>
              <Field label="Business Name" value={content.brand?.businessName ?? ''} onChange={v => update('brand', 'businessName', v)} />
              <Field label="Tagline" value={content.brand?.tagline ?? ''} onChange={v => update('brand', 'tagline', v)} />
              <ColorField label="Primary Color" value={content.brand?.primaryColor ?? '#3B82F6'} onChange={v => update('brand', 'primaryColor', v)} />
              <ColorField label="Secondary Color" value={content.brand?.secondaryColor ?? '#1E40AF'} onChange={v => update('brand', 'secondaryColor', v)} />
            </>
          )}
          {activeSection === 'seo' && (
            <>
              <Field label="Meta Title" value={content.seo?.metaTitle ?? ''} onChange={v => update('seo', 'metaTitle', v)} />
              <Field label="Meta Description" value={content.seo?.metaDescription ?? ''} onChange={v => update('seo', 'metaDescription', v)} textarea rows={3} />
              <p className="text-xs text-gray-400">Meta title should be 50–60 characters. Description should be 150–160 characters.</p>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative bg-gray-100">
        <div className="absolute inset-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-0" title="Website Preview" />
        </div>

        {activeField && (
          <div className="absolute bottom-6 right-6 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 z-10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{activeField.label}</span>
              <button onClick={() => setActiveField(null)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors text-lg leading-none">
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
