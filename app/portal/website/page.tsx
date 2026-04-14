'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlock = Record<string, any>

const ADMIN_KEYS = new Set(['brand', 'seo', '_meta', '_schema', '_sections'])
const TEXTAREA_KEYS = new Set(['body', 'description', 'address', 'bio', 'text', 'notes', 'subheadline', 'tagline', 'summary', 'message'])
const COLOR_KEYS = new Set(['primaryColor', 'secondaryColor', 'backgroundColor', 'accentColor', 'color'])

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim()
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
  const [content, setContent] = useState<ContentBlock>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'pushed' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<string>('')
  const [siteUrl, setSiteUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeField, setActiveField] = useState<{ section: string; field: string; value: string; label: string } | null>(null)
  const [galleryInputs, setGalleryInputs] = useState<Record<string, string>>({})

  const sections = Object.keys(content).filter(k => !ADMIN_KEYS.has(k) && content[k] != null)

  const pushToPreview = useCallback((c: ContentBlock) => {
    if (sendTimer.current) clearTimeout(sendTimer.current)
    sendTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  const enableEditMode = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'setEditMode', enabled: true }, '*')
  }, [])

  const update = useCallback((section: string, field: string, value: string) => {
    setContent(prev => {
      const sectionData = prev[section]
      let updated: unknown
      if (Array.isArray(sectionData) && field.includes('.')) {
        const [idx, prop] = field.split('.')
        const arr = [...sectionData]
        arr[parseInt(idx)] = { ...arr[parseInt(idx)], [prop]: value }
        updated = arr
      } else if (typeof sectionData === 'object' && !Array.isArray(sectionData)) {
        updated = { ...sectionData, [field]: value }
      } else {
        updated = sectionData
      }
      const next = { ...prev, [section]: updated }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const addListItem = useCallback((section: string) => {
    setContent(prev => {
      const arr = Array.isArray(prev[section]) ? [...prev[section]] : []
      const first = arr[0]
      const template = first
        ? Object.fromEntries(Object.keys(first).map(k => [k, k === 'id' ? String(Date.now()) : '']))
        : { id: String(Date.now()), title: '', description: '' }
      template.id = String(Date.now())
      arr.push(template)
      const next = { ...prev, [section]: arr }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const removeListItem = useCallback((section: string, idx: number) => {
    setContent(prev => {
      const arr = [...prev[section]]
      arr.splice(idx, 1)
      const next = { ...prev, [section]: arr }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const addGalleryImage = useCallback((section: string) => {
    const url = (galleryInputs[section] || '').trim()
    if (!url) return
    setContent(prev => {
      const arr = Array.isArray(prev[section]) ? [...prev[section], url] : [url]
      const next = { ...prev, [section]: arr }
      pushToPreview(next)
      return next
    })
    setGalleryInputs(prev => ({ ...prev, [section]: '' }))
  }, [galleryInputs, pushToPreview])

  const removeGalleryImage = useCallback((section: string, idx: number) => {
    setContent(prev => {
      const arr = [...prev[section]]
      arr.splice(idx, 1)
      const next = { ...prev, [section]: arr }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const push = useCallback(async () => {
    setPushStatus('pushing')
    try {
      const res = await fetch('/api/portal/website/push', { method: 'POST' })
      setPushStatus(res.ok ? 'pushed' : 'error')
      setTimeout(() => setPushStatus('idle'), 3000)
    } catch {
      setPushStatus('error')
      setTimeout(() => setPushStatus('idle'), 3000)
    }
  }, [])

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
        if (data?.content) {
          setContent(data.content as ContentBlock)
          const first = Object.keys(data.content as ContentBlock).find(k => !ADMIN_KEYS.has(k))
          if (first) setActiveSection(first)
        }
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
        const fieldPart = field.split('.').pop() || field
        setActiveField({ section, field, value: currentValue, label: humanize(fieldPart) })
        setActiveSection(section)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const renderSectionContent = (sectionKey: string) => {
    const data = content[sectionKey]
    if (Array.isArray(data) && (data.length === 0 || typeof data[0] === 'string')) {
      const gallery = data as string[]
      const inputVal = galleryInputs[sectionKey] || ''
      return (
        <div className="space-y-3">
          <p className="text-xs text-gray-400 leading-relaxed">Add photos by pasting an image link below.</p>
          <div className="flex gap-2">
            <input type="text" placeholder="Paste image URL…" value={inputVal}
              onChange={e => setGalleryInputs(prev => ({ ...prev, [sectionKey]: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') addGalleryImage(sectionKey) }}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
            <button onClick={() => addGalleryImage(sectionKey)} disabled={!inputVal.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors">Add</button>
          </div>
          {gallery.length === 0 ? (
            <div className="py-10 text-center text-sm text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">No photos yet.<br />Paste a URL above to add your first photo.</div>
          ) : (
            <div className="space-y-2">
              {gallery.map((url, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200">
                  <img src={url} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 bg-gray-200" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  <span className="flex-1 text-xs text-gray-500 truncate">{url}</span>
                  <button onClick={() => removeGalleryImage(sectionKey, idx)} className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors text-lg leading-none">×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )
    }
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const items = data as Record<string, string>[]
      const editableKeys = Object.keys(items[0] || {}).filter(k => k !== 'id' && typeof items[0][k] === 'string')
      const singular = humanize(sectionKey.replace(/s$/, ''))
      return (
        <>
          {items.map((item, idx) => (
            <div key={item.id || idx} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-gray-50/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-600">{singular} {idx + 1}</span>
                <button onClick={() => removeListItem(sectionKey, idx)} className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2 py-0.5 rounded transition-colors">Remove</button>
              </div>
              {editableKeys.map(k => (
                <Field key={k} label={humanize(k)} value={item[k] || ''} onChange={v => update(sectionKey, `${idx}.${k}`, v)} textarea={TEXTAREA_KEYS.has(k)} rows={3} />
              ))}
            </div>
          ))}
          <button onClick={() => addListItem(sectionKey)} className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50/30 transition-all">
            + Add {singular}
          </button>
        </>
      )
    }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const fields = Object.entries(data as Record<string, unknown>).filter(([, v]) => typeof v === 'string') as [string, string][]
      if (fields.length === 0) return <p className="text-sm text-gray-400">No editable fields in this section.</p>
      return (
        <>
          {fields.map(([key, value]) => {
            if (COLOR_KEYS.has(key) || key.toLowerCase().includes('color')) {
              return <ColorField key={key} label={humanize(key)} value={value} onChange={v => update(sectionKey, key, v)} />
            }
            const isTextarea = TEXTAREA_KEYS.has(key) || key.toLowerCase().includes('body') || key.toLowerCase().includes('text')
            return <Field key={key} label={humanize(key)} value={value} onChange={v => update(sectionKey, key, v)} textarea={isTextarea} rows={isTextarea ? (key.toLowerCase().includes('body') ? 6 : 3) : 1} />
          })}
        </>
      )
    }
    return <p className="text-sm text-gray-400">No editable content in this section.</p>
  }

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
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Your website is on its way</h2>
          <p className="text-sm text-gray-500 leading-relaxed mb-6">
            The NGF team is building your website. Once it&apos;s live, you&apos;ll be able to edit your content right here.
          </p>
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-600 font-medium">Have questions? Reach out to your NGF account manager.</p>
          </div>
        </div>
      </div>
    )
  }

  const previewUrl = siteUrl || (clientId ? `/preview?clientId=${clientId}` : '/preview')
  const isRealSite = !!siteUrl

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Website Editor</h2>
            <button onClick={save} disabled={saveStatus === 'saving'}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                saveStatus === 'saving' ? 'bg-gray-100 text-gray-400 cursor-wait'
                : saveStatus === 'saved' ? 'bg-green-100 text-green-700'
                : saveStatus === 'error' ? 'bg-red-100 text-red-700'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
              }`}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? '✗ Error' : 'Save Draft'}
            </button>
          </div>
          <button
            onClick={push}
            disabled={pushStatus === 'pushing'}
            className={`mt-2 w-full py-2 rounded-lg text-xs font-semibold transition-all ${
              pushStatus === 'pushing' ? 'bg-gray-100 text-gray-400 cursor-wait'
              : pushStatus === 'pushed' ? 'bg-green-600 text-white'
              : pushStatus === 'error' ? 'bg-red-100 text-red-700'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {pushStatus === 'pushing' ? 'Pushing…' : pushStatus === 'pushed' ? '✓ Live on Website' : pushStatus === 'error' ? '✗ Push Failed' : '🚀 Push to Website'}
          </button>
          <a href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`} target="_blank" rel="noopener noreferrer"
            className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline truncate">
            <span className="truncate">{siteUrl.replace(/^https?:\/\//, '')}</span>
            <span className="flex-shrink-0">↗</span>
          </a>
        </div>

        {/* Sidebar body — two modes */}
        {isRealSite ? (
          /* Real site mode: click-to-edit panel, no tabs */
          <div className="flex-1 overflow-y-auto">
            {activeField ? (
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Editing</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{activeField.label}</p>
                  </div>
                  <button onClick={() => setActiveField(null)}
                    className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors text-lg leading-none">×</button>
                </div>
                <textarea
                  autoFocus
                  rows={4}
                  value={activeField.value}
                  onChange={e => {
                    const val = e.target.value
                    setActiveField(prev => prev ? { ...prev, value: val } : null)
                    update(activeField.section, activeField.field, val)
                  }}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400">Changes appear live in the preview. Click Save when done.</p>
                <button onClick={() => setActiveField(null)}
                  className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded-lg transition-colors">
                  Done
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                  <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </div>
                <p className="text-sm font-semibold text-gray-800 mb-1">Click to edit</p>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Hover over text on your site — editable fields glow blue. Click one to edit it here.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Generic template mode: section tabs */
          <>
            <div className="flex border-b border-gray-100 overflow-x-auto flex-shrink-0">
              {sections.map(s => (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`px-3 py-2 text-xs font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    activeSection === s ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}>
                  {humanize(s)}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {activeSection ? renderSectionContent(activeSection) : (
                <p className="text-sm text-gray-400 text-center pt-8">No sections found.</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      <div className="flex-1 relative bg-gray-100">
        <div className="absolute inset-2 bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
          <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>
            <span className="text-xs text-gray-400 flex-1 text-center">
              {isRealSite ? 'Hover over text to see what’s editable, then click to edit' : 'Click any text on your site to edit it'}
            </span>
          </div>
          <iframe ref={iframeRef} src={previewUrl} onLoad={enableEditMode}
            className="w-full border-0" style={{ height: 'calc(100% - 37px)' }} title="Website Preview" />
        </div>
      </div>
    </div>
  )
}
