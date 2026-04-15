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
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {textarea ? (
        <textarea rows={rows} value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
      ) : (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white" />
      )}
    </div>
  )
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#3B82F6'} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-transparent" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono bg-white" />
      </div>
    </div>
  )
}

export default function WebsiteEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [content, setContent] = useState<ContentBlock>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'published' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<string>('')
  const [siteUrl, setSiteUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [activeField, setActiveField] = useState<{ section: string; field: string; value: string; label: string } | null>(null)
  const [galleryInputs, setGalleryInputs] = useState<Record<string, string>>({})
  const [pendingChanges, setPendingChanges] = useState<Array<{ label: string; section: string; field: string; value: string }>>([])
  const [changeLog, setChangeLog] = useState<Array<{ label: string; section: string; value: string; time: string; published: boolean }>>([])

  const [isEditing, setIsEditing] = useState(false)

  const sections = Object.keys(content).filter(k => !ADMIN_KEYS.has(k) && content[k] != null)
  const isRealSite = !!siteUrl

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
      } else if (typeof sectionData === 'object' && sectionData !== null && !Array.isArray(sectionData)) {
        updated = { ...sectionData, [field]: value }
      } else {
        updated = { [field]: value }
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
      const template = first ? Object.fromEntries(Object.keys(first).map(k => [k, k === 'id' ? String(Date.now()) : ''])) : { id: String(Date.now()), title: '', description: '' }
      template.id = String(Date.now())
      arr.push(template)
      const next = { ...prev, [section]: arr }
      pushToPreview(next)
      return next
    })
  }, [pushToPreview])

  const removeListItem = useCallback((section: string, idx: number) => {
    setContent(prev => {
      const arr = [...prev[section]]; arr.splice(idx, 1)
      const next = { ...prev, [section]: arr }; pushToPreview(next); return next
    })
  }, [pushToPreview])

  const addGalleryImage = useCallback((section: string) => {
    const url = (galleryInputs[section] || '').trim()
    if (!url) return
    setContent(prev => {
      const arr = Array.isArray(prev[section]) ? [...prev[section], url] : [url]
      const next = { ...prev, [section]: arr }; pushToPreview(next); return next
    })
    setGalleryInputs(prev => ({ ...prev, [section]: '' }))
  }, [galleryInputs, pushToPreview])

  const removeGalleryImage = useCallback((section: string, idx: number) => {
    setContent(prev => {
      const arr = [...prev[section]]; arr.splice(idx, 1)
      const next = { ...prev, [section]: arr }; pushToPreview(next); return next
    })
  }, [pushToPreview])

  const save = useCallback(async () => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/portal/website', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) })
      setSaveStatus(res.ok ? 'saved' : 'error')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000) }
  }, [content])

  const push = useCallback(async () => {
    setPushStatus('pushing')
    try {
      const res = await fetch('/api/portal/website/push', { method: 'POST' })
      if (res.ok) { setPendingChanges([]); setPushStatus('published'); setChangeLog(prev => prev.map(e => ({ ...e, published: true }))) }
      else setPushStatus('error')
      setTimeout(() => setPushStatus('idle'), 3000)
    } catch { setPushStatus('error'); setTimeout(() => setPushStatus('idle'), 3000) }
  }, [])

  const handleDone = useCallback(() => {
    if (activeField) {
      const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      setPendingChanges(prev => {
        const idx = prev.findIndex(c => c.section === activeField.section && c.field === activeField.field)
        const entry = { label: activeField.label, section: activeField.section, field: activeField.field, value: activeField.value }
        if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n }
        return [...prev, entry]
      })
      setChangeLog(prev => {
        const entry = { label: activeField.label, section: activeField.section, value: activeField.value, time: timeStr, published: false }
        const idx = prev.findIndex(c => c.section === activeField.section && c.label === activeField.label)
        if (idx >= 0) { const n = [...prev]; n[idx] = entry; return n }
        return [entry, ...prev]
      })
    }
    setActiveField(null)
    setIsEditing(false)
    save()
  }, [activeField, save])

  useEffect(() => {
    fetch('/api/portal/website').then(r => r.json()).then(data => {
      if (data?.content) { setContent(data.content as ContentBlock); const first = Object.keys(data.content as ContentBlock).find(k => !ADMIN_KEYS.has(k)); if (first) setActiveSection(first) }
      if (data?.site_url) setSiteUrl(data.site_url as string)
      if (data?.client_id) setClientId(data.client_id as string)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ngfReady') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'setEditMode', enabled: true }, '*')
        setContent(prev => { setTimeout(() => { iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: prev }, '*') }, 50); return prev })
      }
      if (e.data?.type === 'fieldClick') {
        const { section, field, currentValue } = e.data as { section: string; field: string; currentValue: string }
        const fieldPart = field.split('.').pop() || field
        setActiveField({ section, field, value: currentValue, label: humanize(fieldPart) })
        setIsEditing(true)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const renderSectionContent = (sectionKey: string) => {
    const data = content[sectionKey]
    if (Array.isArray(data) && (data.length === 0 || typeof data[0] === 'string')) {
      const gallery = data as string[]; const inputVal = galleryInputs[sectionKey] || ''
      return (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Paste image URL…" value={inputVal} onChange={e => setGalleryInputs(prev => ({ ...prev, [sectionKey]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addGalleryImage(sectionKey) }} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={() => addGalleryImage(sectionKey)} disabled={!inputVal.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium">Add</button>
          </div>
          {gallery.length === 0 ? <p className="text-xs text-gray-400 text-center py-4">No photos yet.</p> : (
            <div className="space-y-2">{gallery.map((url, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 bg-white rounded-lg border border-gray-200">
                <img src={url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-gray-100" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                <span className="flex-1 text-xs text-gray-500 truncate">{url}</span>
                <button onClick={() => removeGalleryImage(sectionKey, idx)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 rounded transition-colors text-lg leading-none">×</button>
              </div>
            ))}</div>
          )}
        </div>
      )
    }
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
      const items = data as Record<string, string>[]; const editableKeys = Object.keys(items[0] || {}).filter(k => k !== 'id' && typeof items[0][k] === 'string'); const singular = humanize(sectionKey.replace(/s$/, ''))
      return (
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id || idx} className="border border-gray-200 rounded-xl p-3 space-y-3 bg-white">
              <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-600">{singular} {idx + 1}</span><button onClick={() => removeListItem(sectionKey, idx)} className="text-xs text-red-400 hover:text-red-600 transition-colors">Remove</button></div>
              {editableKeys.map(k => <Field key={k} label={humanize(k)} value={item[k] || ''} onChange={v => update(sectionKey, `${idx}.${k}`, v)} textarea={TEXTAREA_KEYS.has(k)} rows={3} />)}
            </div>
          ))}
          <button onClick={() => addListItem(sectionKey)} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all">+ Add {singular}</button>
        </div>
      )
    }
    if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
      const fields = Object.entries(data as Record<string, unknown>).filter(([, v]) => typeof v === 'string') as [string, string][]
      if (fields.length === 0) return <p className="text-sm text-gray-400">Nothing editable here.</p>
      return (
        <div className="space-y-4">
          {fields.map(([key, value]) => {
            if (COLOR_KEYS.has(key) || key.toLowerCase().includes('color')) return <ColorField key={key} label={humanize(key)} value={value} onChange={v => update(sectionKey, key, v)} />
            const isTextarea = TEXTAREA_KEYS.has(key) || key.toLowerCase().includes('body') || key.toLowerCase().includes('text')
            return <Field key={key} label={humanize(key)} value={value} onChange={v => update(sectionKey, key, v)} textarea={isTextarea} rows={isTextarea ? (key.toLowerCase().includes('body') ? 5 : 3) : 1} />
          })}
        </div>
      )
    }
    return <p className="text-sm text-gray-400">No editable content.</p>
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center"><div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-sm text-gray-500">Loading your website…</p></div>
      </div>
    )
  }

  if (!siteUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
          <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Your website is coming soon</h2>
          <p className="text-sm text-gray-400 leading-relaxed">Once your site is live, you&apos;ll be able to edit content directly from here.</p>
        </div>
      </div>
    )
  }

  const previewUrl = siteUrl || (clientId ? `/preview?clientId=${clientId}` : '/preview')
  const hasPending = pendingChanges.length > 0

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Sidebar ────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-900 truncate flex-1 transition-colors">{siteUrl.replace(/^https?:\/\//, '')}</a>
            <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
          <button onClick={push} disabled={!hasPending || pushStatus === 'pushing'}
            className={`w-full h-9 rounded-lg text-sm font-semibold transition-all ${
              hasPending && pushStatus === 'idle' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : pushStatus === 'pushing' ? 'bg-blue-100 text-blue-400 cursor-wait'
              : pushStatus === 'published' ? 'bg-emerald-100 text-emerald-700'
              : pushStatus === 'error' ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            {pushStatus === 'pushing' ? 'Publishing…' : pushStatus === 'published' ? '✓ Published!' : pushStatus === 'error' ? 'Publish failed' : hasPending ? `Publish ${pendingChanges.length} change${pendingChanges.length !== 1 ? 's' : ''}` : 'No changes to publish'}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Editing a field ── */}
          {isRealSite && isEditing && activeField ? (
            <div className="p-4 space-y-4">
              <button onClick={() => { setActiveField(null); setIsEditing(false) }} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{humanize(activeField.section)}</p>
                <h3 className="text-sm font-semibold text-gray-900">{activeField.label}</h3>
              </div>
              <textarea
                autoFocus
                rows={5}
                value={activeField.value}
                onChange={e => { const val = e.target.value; setActiveField(prev => prev ? { ...prev, value: val } : null); update(activeField.section, activeField.field, val) }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white leading-relaxed"
                placeholder={`Enter ${activeField.label.toLowerCase()}…`}
              />
              <button onClick={handleDone}
                className={`w-full h-9 rounded-lg text-sm font-semibold transition-all ${
                  saveStatus === 'saving' ? 'bg-gray-100 text-gray-400 cursor-wait'
                  : saveStatus === 'saved' ? 'bg-emerald-100 text-emerald-700'
                  : saveStatus === 'error' ? 'bg-red-100 text-red-700'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}>
                {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Error saving' : 'Done ✓ Save'}
              </button>
              <p className="text-xs text-gray-400 text-center">Changes appear live in the preview</p>
            </div>

          ) : isRealSite ? (
            <div className="flex flex-col h-full">

              {/* Pending changes */}
              {hasPending && (
                <div className="p-4 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">{pendingChanges.length} Unsaved Change{pendingChanges.length !== 1 ? 's' : ''}</p>
                  <div className="space-y-2">
                    {pendingChanges.map((change, i) => (
                      <button key={i} onClick={() => { setActiveField({ section: change.section, field: change.field, value: change.value, label: change.label }); setIsEditing(true) }}
                        className="w-full text-left rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 hover:bg-amber-100 transition-colors">
                        <p className="text-xs font-semibold text-amber-800">{humanize(change.section)} — {change.label}</p>
                        <p className="text-xs text-amber-600 mt-0.5 truncate">{change.value}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Change history */}
              {changeLog.length > 0 && (
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">Change History</p>
                  <div className="space-y-1.5">
                    {changeLog.map((entry, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${entry.published ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-gray-700 font-medium truncate">{humanize(entry.section)} — {entry.label}</p>
                          <p className="text-xs text-gray-400 truncate">{entry.value}</p>
                        </div>
                        <span className="text-xs text-gray-300 flex-shrink-0 mt-0.5">{entry.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-emerald-400" /><span className="text-xs text-gray-400">Published</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-amber-400" /><span className="text-xs text-gray-400">Saved, not published</span></div>
                  </div>
                </div>
              )}

              {/* Idle guide */}
              <div className="p-4 flex-1">
                {!hasPending && (
                  <div className="mb-5">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-3">
                      <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">Click to edit</p>
                    <p className="text-xs text-gray-400 leading-relaxed">Text that can be edited glows blue when you hover over it. Click any field to start.</p>
                  </div>
                )}

                {/* Section list for quick access — only for generic template mode */}
                {!isRealSite && sections.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Sections</p>
                    <div className="space-y-1">
                      {sections.map(s => (
                        <button key={s} onClick={() => setActiveSection(s)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${activeSection === s ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
                          {humanize(s)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

          ) : (
            /* Generic template mode */
            <>
              <div className="flex border-b border-gray-100 overflow-x-auto flex-shrink-0">
                {sections.map(s => (
                  <button key={s} onClick={() => setActiveSection(s)}
                    className={`px-3 py-2 text-xs font-medium capitalize whitespace-nowrap transition-colors border-b-2 -mb-px ${activeSection === s ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {humanize(s)}
                  </button>
                ))}
              </div>
              <div className="p-4 space-y-4">
                {activeSection ? renderSectionContent(activeSection) : <p className="text-sm text-gray-400 text-center pt-6">Select a section above.</p>}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Preview ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Edit mode bar */}
        <div className={`flex items-center gap-3 px-4 h-10 flex-shrink-0 transition-colors ${isEditing ? 'bg-blue-600' : 'bg-gray-800'}`}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          </div>
          <span className="text-xs text-white/70 flex-1 text-center">
            {isEditing && activeField ? `Editing: ${humanize(activeField.section)} — ${activeField.label}` : 'Hover over any text that glows blue, then click to edit'}
          </span>
          {isEditing && (
            <button onClick={() => { setActiveField(null); setIsEditing(false) }} className="text-xs text-white/60 hover:text-white transition-colors flex-shrink-0">Cancel</button>
          )}
        </div>

        {/* iframe */}
        <div className="flex-1 bg-white relative">
          <iframe
            ref={iframeRef}
            src={previewUrl}
            onLoad={enableEditMode}
            className="w-full h-full border-0"
            title="Website Preview"
          />
        </div>
      </div>

    </div>
  )
}
