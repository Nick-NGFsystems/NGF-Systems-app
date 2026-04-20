'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { TemplateSchema, FieldDefinition, RepeatableField, LeafField } from '@/lib/templates/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlock = Record<string, any>

const ADMIN_KEYS = new Set(['_meta', '_schema'])

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim()
}

// ── Field components ──────────────────────────────────────────────────────────

function TextField({ label, value, onChange, textarea, rows = 3, placeholder }: {
  label: string; value: string; onChange: (v: string) => void
  textarea?: boolean; rows?: number; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      {textarea ? (
        <textarea rows={rows} value={value || ''} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      ) : (
        <input type="text" value={value || ''} placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      )}
    </div>
  )
}

function ColorFieldInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input type="color" value={value || '#3B82F6'} onChange={e => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-transparent" />
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono bg-white" />
      </div>
    </div>
  )
}

function ImageFieldInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input type="text" value={value || ''} placeholder={placeholder || 'https://…'} onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      {value && (
        <img src={value} alt="" className="mt-2 w-full h-24 object-cover rounded-lg bg-gray-100"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
      )}
    </div>
  )
}

function ToggleFieldInput({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <button onClick={() => onChange(!value)}
        className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors ${value ? 'bg-blue-600' : 'bg-gray-200'}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${value ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}

function LeafFieldInput({ fieldKey, field, value, onChange }: {
  fieldKey: string
  field: LeafField
  value: string | boolean
  onChange: (v: string | boolean) => void
}) {
  if (field.type === 'color') return <ColorFieldInput label={field.label} value={value as string} onChange={v => onChange(v)} />
  if (field.type === 'toggle') return <ToggleFieldInput label={field.label} value={!!value} onChange={v => onChange(v)} />
  if (field.type === 'image') return <ImageFieldInput label={field.label} value={value as string} onChange={v => onChange(v)} placeholder={field.placeholder} />
  if (field.type === 'textarea') return <TextField label={field.label} value={value as string} onChange={v => onChange(v)} textarea rows={field.rows ?? 3} placeholder={field.placeholder} />
  return <TextField label={field.label} value={value as string} onChange={v => onChange(v)} placeholder={field.placeholder} />
}

// ── Repeatable group editor ───────────────────────────────────────────────────

function RepeatableEditor({ fieldKey, field, items, onUpdate, onAdd, onRemove, onMove }: {
  fieldKey: string
  field: RepeatableField
  items: Record<string, string>[]
  onUpdate: (idx: number, subKey: string, value: string | boolean) => void
  onAdd: () => void
  onRemove: (idx: number) => void
  onMove: (idx: number, dir: 'up' | 'down') => void
}) {
  const [expanded, setExpanded] = useState<number | null>(items.length > 0 ? 0 : null)
  const atMax = field.maxItems != null && items.length >= field.maxItems
  const atMin = field.minItems != null && items.length <= field.minItems

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{field.label}</span>
        {!atMax && (
          <button onClick={onAdd} className="text-xs text-blue-600 hover:text-blue-800 font-medium">+ Add {field.itemLabel}</button>
        )}
      </div>
      {items.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg">No {field.label.toLowerCase()} yet.</p>
      )}
      {items.map((item, idx) => (
        <div key={idx} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50 border-b border-gray-100 cursor-pointer"
            onClick={() => setExpanded(expanded === idx ? null : idx)}>
            <span className="text-xs font-semibold text-gray-700">{field.itemLabel} {idx + 1}{item.title || item.name ? ` — ${item.title || item.name}` : ''}</span>
            <div className="flex items-center gap-1.5">
              {idx > 0 && <button onClick={e => { e.stopPropagation(); onMove(idx, 'up') }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs">↑</button>}
              {idx < items.length - 1 && <button onClick={e => { e.stopPropagation(); onMove(idx, 'down') }} className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-700 text-xs">↓</button>}
              {!atMin && <button onClick={e => { e.stopPropagation(); onRemove(idx) }} className="w-5 h-5 flex items-center justify-center text-red-300 hover:text-red-500 text-base leading-none">×</button>}
              <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform ${expanded === idx ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          {expanded === idx && (
            <div className="p-3 space-y-3">
              {Object.entries(field.fields).map(([subKey, subField]) => (
                <LeafFieldInput key={subKey} fieldKey={subKey} field={subField}
                  value={item[subKey] ?? ''} onChange={v => onUpdate(idx, subKey, v)} />
              ))}
            </div>
          )}
        </div>
      ))}
      {!atMax && items.length > 0 && (
        <button onClick={onAdd} className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-all">
          + Add {field.itemLabel}
        </button>
      )}
    </div>
  )
}

// ── Section panel ─────────────────────────────────────────────────────────────

function SectionPanel({ sectionKey, schema, data, onUpdate, onAddItem, onRemoveItem, onMoveItem, onBack }: {
  sectionKey: string
  schema: { label: string; fields: Record<string, FieldDefinition> }
  data: ContentBlock
  onUpdate: (fieldPath: string, value: string | boolean) => void
  onAddItem: (fieldKey: string) => void
  onRemoveItem: (fieldKey: string, idx: number) => void
  onMoveItem: (fieldKey: string, idx: number, dir: 'up' | 'down') => void
  onBack: () => void
}) {
  return (
    <div className="p-4 space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors">
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        All Sections
      </button>
      <h3 className="text-sm font-semibold text-gray-900">{schema.label}</h3>
      {Object.entries(schema.fields).map(([fieldKey, field]) => {
        if (field.type === 'repeatable') {
          const items: Record<string, string>[] = Array.isArray(data[fieldKey]) ? data[fieldKey] : []
          return (
            <RepeatableEditor
              key={fieldKey}
              fieldKey={fieldKey}
              field={field}
              items={items}
              onUpdate={(idx, subKey, value) => onUpdate(`${fieldKey}.${idx}.${subKey}`, value as string)}
              onAdd={() => onAddItem(fieldKey)}
              onRemove={(idx) => onRemoveItem(fieldKey, idx)}
              onMove={(idx, dir) => onMoveItem(fieldKey, idx, dir)}
            />
          )
        }
        return (
          <LeafFieldInput key={fieldKey} fieldKey={fieldKey} field={field}
            value={data[fieldKey] ?? ''} onChange={v => onUpdate(fieldKey, v)} />
        )
      })}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function applySchemaDefaults(content: ContentBlock, schema: TemplateSchema): ContentBlock {
  const result: ContentBlock = {}
  for (const [sectionKey, section] of Object.entries(schema.sections)) {
    const existing = content[sectionKey] ?? {}
    const sectionData: ContentBlock = {}
    for (const [fieldKey, field] of Object.entries(section.fields)) {
      if (field.type === 'repeatable') {
        sectionData[fieldKey] = Array.isArray(existing[fieldKey]) && existing[fieldKey].length > 0
          ? existing[fieldKey]
          : Array.from({ length: field.minItems ?? 1 }, () => ({ ...field.defaultItem }))
      } else {
        sectionData[fieldKey] = existing[fieldKey] ?? field.default ?? ''
      }
    }
    result[sectionKey] = sectionData
  }
  // Preserve any extra keys not in schema
  for (const [k, v] of Object.entries(content)) {
    if (!(k in result) && !ADMIN_KEYS.has(k)) result[k] = v
  }
  return result
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function WebsiteEditorPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content, setContent] = useState<ContentBlock>({})
  const [schema, setSchema] = useState<TemplateSchema | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'published' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [siteUrl, setSiteUrl] = useState('')
  const [clientId, setClientId] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasDraft, setHasDraft] = useState(false)

  // Click-to-edit state (from iframe)
  const [clickEditField, setClickEditField] = useState<{ section: string; field: string; value: string; label: string } | null>(null)

  const pushToPreview = useCallback((c: ContentBlock) => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  const scheduleSave = useCallback((c: ContentBlock) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/portal/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: c }),
        })
        if (res.ok) { setHasDraft(true); setSaveStatus('saved') } else { setSaveStatus('error') }
        setTimeout(() => setSaveStatus('idle'), 2500)
      } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2500) }
    }, 800)
  }, [])

  const updateField = useCallback((sectionKey: string, fieldPath: string, value: string | boolean) => {
    setContent(prev => {
      const sectionData = prev[sectionKey] ?? {}
      let updated: ContentBlock

      if (fieldPath.includes('.')) {
        // Nested path: e.g. "steps.0.title"
        const parts = fieldPath.split('.')
        if (parts.length === 3) {
          const [arrayKey, idxStr, subKey] = parts
          const arr = Array.isArray(sectionData[arrayKey]) ? [...sectionData[arrayKey]] : []
          const idx = parseInt(idxStr)
          arr[idx] = { ...arr[idx], [subKey]: value }
          updated = { ...sectionData, [arrayKey]: arr }
        } else {
          updated = { ...sectionData, [fieldPath]: value }
        }
      } else {
        updated = { ...sectionData, [fieldPath]: value }
      }

      const next = { ...prev, [sectionKey]: updated }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [pushToPreview, scheduleSave])

  const addRepeatableItem = useCallback((sectionKey: string, fieldKey: string) => {
    setContent(prev => {
      const sectionData = prev[sectionKey] ?? {}
      const schemaSection = (window as Window & { __schema?: TemplateSchema }).__schema?.sections[sectionKey]
      const fieldDef = schemaSection?.fields[fieldKey]
      const defaultItem = fieldDef?.type === 'repeatable' ? { ...fieldDef.defaultItem } : { title: '', description: '' }
      const arr = Array.isArray(sectionData[fieldKey]) ? [...sectionData[fieldKey], defaultItem] : [defaultItem]
      const next = { ...prev, [sectionKey]: { ...sectionData, [fieldKey]: arr } }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [pushToPreview, scheduleSave])

  const removeRepeatableItem = useCallback((sectionKey: string, fieldKey: string, idx: number) => {
    setContent(prev => {
      const sectionData = prev[sectionKey] ?? {}
      const arr = [...(sectionData[fieldKey] ?? [])]
      arr.splice(idx, 1)
      const next = { ...prev, [sectionKey]: { ...sectionData, [fieldKey]: arr } }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [pushToPreview, scheduleSave])

  const moveRepeatableItem = useCallback((sectionKey: string, fieldKey: string, idx: number, dir: 'up' | 'down') => {
    setContent(prev => {
      const sectionData = prev[sectionKey] ?? {}
      const arr = [...(sectionData[fieldKey] ?? [])]
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= arr.length) return prev;
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]
      const next = { ...prev, [sectionKey]: { ...sectionData, [fieldKey]: arr } }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [pushToPreview, scheduleSave])

  const push = useCallback(async () => {
    setPushStatus('pushing')
    try {
      const saveRes = await fetch('/api/portal/website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!saveRes.ok) { setPushStatus('error'); setTimeout(() => setPushStatus('idle'), 3000); return }

      const res = await fetch('/api/portal/website/push', { method: 'POST' })
      if (res.ok) { setHasDraft(false); setPushStatus('published') } else { setPushStatus('error') }
      setTimeout(() => setPushStatus('idle'), 3000)
    } catch { setPushStatus('error'); setTimeout(() => setPushStatus('idle'), 3000) }
  }, [content])

  // Load content + schema on mount
  useEffect(() => {
    fetch('/api/portal/website').then(r => r.json()).then(data => {
      if (data?.schema) {
        setSchema(data.schema as TemplateSchema);
        (window as Window & { __schema?: TemplateSchema }).__schema = data.schema
        const withDefaults = applySchemaDefaults(data.content ?? {}, data.schema)
        setContent(withDefaults)
        const firstSection = Object.keys(data.schema.sections)[0]
        if (firstSection) setActiveSection(firstSection)
      } else if (data?.content) {
        setContent(data.content as ContentBlock)
      }
      if (data?.has_draft) setHasDraft(true)
      if (data?.site_url) setSiteUrl(data.site_url as string)
      if (data?.client_id) setClientId(data.client_id as string)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Listen for iframe click-to-edit events
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ngfReady') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'setEditMode', enabled: true }, '*')
        setTimeout(() => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content }, '*')
        }, 50)
      }
      if (e.data?.type === 'fieldClick') {
        const { section, field, currentValue } = e.data as { section: string; field: string; currentValue: string }
        const fieldPart = field.split('.').pop() || field
        setClickEditField({ section, field, value: currentValue, label: humanize(fieldPart) })
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [content])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading your website…</p>
        </div>
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
          <p className="text-sm text-gray-400 leading-relaxed">Once your site is live, you'll be able to edit content directly from here.</p>
        </div>
      </div>
    )
  }

  const normalizedSiteUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
  const previewUrl = normalizedSiteUrl || (clientId ? `/preview?clientId=${clientId}` : '/preview')
  const sections = schema ? Object.entries(schema.sections) : []

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* ── Sidebar ── */}
      <div className="w-72 flex-shrink-0 bg-white border-r border-gray-100 flex flex-col">

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <a href={normalizedSiteUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-900 truncate flex-1 transition-colors">
              {siteUrl.replace(/^https?:\/\//, '')}
            </a>
            <a href={normalizedSiteUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
          <button onClick={push} disabled={!hasDraft || pushStatus === 'pushing'}
            className={`w-full h-9 rounded-lg text-sm font-semibold transition-all ${
              hasDraft && pushStatus === 'idle' ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : pushStatus === 'pushing' ? 'bg-blue-100 text-blue-400 cursor-wait'
              : pushStatus === 'published' ? 'bg-emerald-100 text-emerald-700'
              : pushStatus === 'error' ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            {pushStatus === 'pushing' ? 'Publishing…'
              : pushStatus === 'published' ? '✓ Live on website!'
              : pushStatus === 'error' ? 'Publish failed — try again'
              : hasDraft ? 'Publish to Website'
              : 'No changes to publish'}
          </button>
          {saveStatus !== 'idle' && (
            <p className={`text-center text-xs mt-2 ${saveStatus === 'saving' ? 'text-gray-400' : saveStatus === 'saved' ? 'text-emerald-600' : 'text-red-500'}`}>
              {saveStatus === 'saving' ? 'Saving draft…' : saveStatus === 'saved' ? '● Draft saved' : 'Save error'}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Click-to-edit modal */}
          {clickEditField ? (
            <div className="p-4 space-y-4">
              <button onClick={() => setClickEditField(null)} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                Back
              </button>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{humanize(clickEditField.section)}</p>
                <h3 className="text-sm font-semibold text-gray-900">{clickEditField.label}</h3>
              </div>
              <textarea autoFocus rows={5}
                value={clickEditField.value}
                onChange={e => {
                  const val = e.target.value
                  setClickEditField(prev => prev ? { ...prev, value: val } : null)
                  updateField(clickEditField.section, clickEditField.field, val)
                }}
                className="w-full border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                placeholder={`Enter ${clickEditField.label.toLowerCase()}…`}
              />
              <button onClick={() => setClickEditField(null)}
                className="w-full h-9 rounded-lg text-sm font-semibold bg-gray-800 hover:bg-gray-900 text-white transition-all">
                Done
              </button>
            </div>

          ) : activeSection && schema?.sections[activeSection] ? (
            <SectionPanel
              sectionKey={activeSection}
              schema={schema.sections[activeSection]}
              data={content[activeSection] ?? {}}
              onUpdate={(fieldPath, value) => updateField(activeSection, fieldPath, value)}
              onAddItem={(fieldKey) => addRepeatableItem(activeSection, fieldKey)}
              onRemoveItem={(fieldKey, idx) => removeRepeatableItem(activeSection, fieldKey, idx)}
              onMoveItem={(fieldKey, idx, dir) => moveRepeatableItem(activeSection, fieldKey, idx, dir)}
              onBack={() => setActiveSection(null)}
            />

          ) : (
            /* Section list */
            <div className="p-4 space-y-5">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Content Sections</p>
                <div className="space-y-1">
                  {sections.map(([key, section]) => (
                    <button key={key} onClick={() => setActiveSection(key)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-colors group">
                      <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">{section.label}</span>
                      <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Jump to Section</p>
                <div className="grid grid-cols-2 gap-1">
                  {sections.slice(0, 6).map(([key, section]) => (
                    <button key={key}
                      onClick={() => iframeRef.current?.contentWindow?.postMessage({ type: 'scrollTo', section: key }, '*')}
                      className="text-left px-3 py-2 rounded-lg text-xs text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors">
                      {section.label}
                    </button>
                  ))}
                </div>
              </div>

              {hasDraft && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
                  <p className="text-xs font-semibold text-amber-800">● Draft saved</p>
                  <p className="text-xs text-amber-600 mt-0.5">Unpublished changes. Click "Publish to Website" when ready.</p>
                </div>
              )}

              <div className="rounded-xl bg-blue-50 border border-blue-100 px-3 py-2.5">
                <p className="text-xs font-semibold text-blue-800 mb-1">💡 Two ways to edit</p>
                <p className="text-xs text-blue-600 leading-relaxed">Click a section above to manage all fields, or hover over glowing text in the preview and click to edit inline.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Preview ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className={`flex items-center gap-3 px-4 h-10 flex-shrink-0 transition-colors ${clickEditField ? 'bg-blue-600' : 'bg-gray-800'}`}>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          </div>
          <span className="text-xs text-white/70 flex-1 text-center">
            {clickEditField
              ? `Editing: ${humanize(clickEditField.section)} — ${clickEditField.label}`
              : 'Hover over glowing text in the preview and click to edit'}
          </span>
          {clickEditField && (
            <button onClick={() => setClickEditField(null)} className="text-xs text-white/60 hover:text-white transition-colors">Cancel</button>
          )}
        </div>
        <div className="flex-1 bg-white relative">
          <iframe ref={iframeRef} src={previewUrl} className="w-full h-full border-0" title="Website Preview" />
        </div>
      </div>

    </div>
  )
}
