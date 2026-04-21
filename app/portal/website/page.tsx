'use client'
import { useState, useRef, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'textarea' | 'image' | 'color' | 'toggle'

interface LeafField {
  type: FieldType
  label: string
  placeholder?: string
  rows?: number
  default?: string
}

interface RepeatableField {
  type: 'repeatable'
  label: string
  itemLabel: string
  minItems?: number
  maxItems?: number
  fields: Record<string, LeafField>
  defaultItem: Record<string, string>
}

type FieldDefinition = LeafField | RepeatableField

interface SectionSchema {
  label: string
  fields: Record<string, FieldDefinition>
}

interface TemplateSchema {
  sections: Record<string, SectionSchema>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ContentBlock = Record<string, any>

interface ClickField {
  section: string
  field: string
  value: string
  label: string
  fieldType: FieldType
  elementRect?: { top: number; left: number; bottom: number; right: number; width: number; height: number }
}

interface PopoverPosition {
  top: number
  left: number
  isSheet: boolean
}

const ADMIN_KEYS = new Set(['_meta', '_schema'])

function humanize(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/\s+/g, ' ').trim()
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
  for (const [k, v] of Object.entries(content)) {
    if (!(k in result) && !ADMIN_KEYS.has(k)) result[k] = v
  }
  return result
}

function getChangedSections(
  current: ContentBlock,
  published: ContentBlock,
  schema: TemplateSchema | null
): { sectionKey: string; label: string; fieldCount: number }[] {
  if (!schema) return []
  const result = []
  for (const [key, section] of Object.entries(schema.sections)) {
    const currStr = JSON.stringify(current[key] ?? {})
    const pubStr  = JSON.stringify(published[key] ?? {})
    if (currStr === pubStr) continue
    let fieldCount = 0
    const currSection = current[key] ?? {}
    const pubSection  = published[key] ?? {}
    for (const fieldKey of Object.keys(section.fields)) {
      if (JSON.stringify(currSection[fieldKey]) !== JSON.stringify(pubSection[fieldKey])) fieldCount++
    }
    result.push({ sectionKey: key, label: section.label, fieldCount })
  }
  return result
}

function resolveFieldType(schema: TemplateSchema | null, section: string, field: string): FieldType {
  if (!schema) return 'textarea'
  const sectionSchema = schema.sections[section]
  if (!sectionSchema) return 'textarea'
  const parts = field.split('.')
  // Leaf field
  const directField = sectionSchema.fields[field]
  if (directField && directField.type !== 'repeatable') return directField.type as FieldType
  // Repeatable item field: e.g. "items.0.title" → look up "items" repeatable, sub-field "title"
  const arrayKey = parts[0]
  const arrayField = sectionSchema.fields[arrayKey]
  if (arrayField?.type === 'repeatable' && parts.length === 3) {
    const subField = arrayField.fields[parts[2]]
    if (subField) return subField.type
  }
  return 'textarea'
}

function computePopoverPosition(
  iframeRect: DOMRect,
  elementRect: ClickField['elementRect'],
  popoverW = 320,
  popoverH = 240
): PopoverPosition {
  if (typeof window === 'undefined') return { top: 0, left: 0, isSheet: false }

  // Mobile: always bottom sheet
  if (window.innerWidth < 640 || !elementRect) {
    return { top: 0, left: 0, isSheet: true }
  }

  const elemBottom = iframeRect.top  + (elementRect?.bottom ?? 0)
  const elemTop    = iframeRect.top  + (elementRect?.top    ?? 0)
  const elemCx     = iframeRect.left + (elementRect?.left   ?? 0) + (elementRect?.width ?? 0) / 2

  let top  = elemBottom + 10
  let left = elemCx - popoverW / 2

  // Flip above if not enough room below
  if (top + popoverH > window.innerHeight - 16) top = elemTop - popoverH - 10

  // Clamp
  top  = Math.max(60, Math.min(top,  window.innerHeight - popoverH - 16))
  left = Math.max(16, Math.min(left, window.innerWidth  - popoverW - 16))

  return { top, left, isSheet: false }
}

// ── Edit Popover ──────────────────────────────────────────────────────────────

function EditPopover({
  field, position, onChange, onDone, onCancel,
}: {
  field: ClickField
  position: PopoverPosition
  onChange: (v: string) => void
  onDone: () => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(field.value)
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => {
    setValue(field.value)
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [field.field, field.section])

  const handleChange = (v: string) => {
    setValue(v)
    onChange(v)
  }

  const wrapperStyle: React.CSSProperties = position.isSheet
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', zIndex: 60 }
    : { position: 'fixed', top: position.top, left: position.left, width: 320, borderRadius: 20, zIndex: 60 }

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(1px)' }}
        onClick={onCancel}
      />

      {/* Card */}
      <div style={wrapperStyle} className="bg-white shadow-2xl border border-black/8 overflow-hidden">
        {/* Handle (sheet only) */}
        {position.isSheet && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
        )}

        <div className="px-5 pt-4 pb-5 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                {humanize(field.section)}
              </p>
              <p className="text-sm font-semibold text-gray-900 mt-0.5">{field.label}</p>
            </div>
            <button
              onClick={onCancel}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-lg leading-none flex-shrink-0 transition-colors"
            >
              ×
            </button>
          </div>

          {/* Input */}
          {field.fieldType === 'color' ? (
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value || '#3B82F6'}
                onChange={e => handleChange(e.target.value)}
                className="w-10 h-10 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-transparent"
              />
              <input
                type="text"
                value={value || ''}
                onChange={e => handleChange(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : field.fieldType === 'image' ? (
            <div className="space-y-2">
              <input
                ref={inputRef as React.Ref<HTMLInputElement>}
                type="text"
                value={value || ''}
                placeholder="https://…"
                onChange={e => handleChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {value && (
                <img
                  src={value} alt=""
                  className="w-full h-24 object-cover rounded-xl bg-gray-100"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              )}
            </div>
          ) : field.fieldType === 'textarea' ? (
            <textarea
              ref={inputRef as React.Ref<HTMLTextAreaElement>}
              value={value || ''}
              rows={position.isSheet ? 5 : 4}
              onChange={e => handleChange(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={value || ''}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onDone() }}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={onCancel}
              className="flex-1 h-10 rounded-xl text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDone}
              className="flex-1 h-10 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Main editor ───────────────────────────────────────────────────────────────

export default function WebsiteEditorPage() {
  const iframeRef   = useRef<HTMLIFrameElement>(null)
  const saveTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTimer= useRef<ReturnType<typeof setTimeout> | null>(null)

  const [content,          setContent]          = useState<ContentBlock>({})
  const [publishedContent, setPublishedContent] = useState<ContentBlock>({})
  const [schema,           setSchema]           = useState<TemplateSchema | null>(null)
  const [saveStatus,       setSaveStatus]       = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pushStatus,       setPushStatus]       = useState<'idle' | 'pushing' | 'published' | 'error'>('idle')
  const [siteUrl,          setSiteUrl]          = useState('')
  const [loading,          setLoading]          = useState(true)
  const [hasDraft,         setHasDraft]         = useState(false)
  const [publishedAt,      setPublishedAt]      = useState<string | null>(null)
  const [changesOpen,      setChangesOpen]      = useState(false)

  const [clickField,    setClickField]    = useState<ClickField | null>(null)
  const [popoverPos,    setPopoverPos]    = useState<PopoverPosition>({ top: 0, left: 0, isSheet: false })

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
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000) }
    }, 800)
  }, [])

  const updateField = useCallback((sectionKey: string, fieldPath: string, value: string | boolean) => {
    setContent(prev => {
      const sectionData = prev[sectionKey] ?? {}
      let updated: ContentBlock

      if (fieldPath.includes('.')) {
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

  const revertSection = useCallback((sectionKey: string) => {
    setContent(prev => {
      const next = { ...prev, [sectionKey]: publishedContent[sectionKey] ?? {} }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [publishedContent, pushToPreview, scheduleSave])

  const revertAll = useCallback(() => {
    setContent(prev => {
      const next = { ...prev }
      for (const key of Object.keys(publishedContent)) {
        next[key] = publishedContent[key]
      }
      pushToPreview(next)
      scheduleSave(next)
      return next
    })
  }, [publishedContent, pushToPreview, scheduleSave])

  const reloadPreview = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
  }, [])

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
      if (res.ok) {
        setHasDraft(false)
        setPublishedContent(content)
        setPublishedAt(new Date().toISOString())
        setPushStatus('published')
        setTimeout(() => reloadPreview(), 1200)
      } else { setPushStatus('error') }
      setTimeout(() => setPushStatus('idle'), 3000)
    } catch { setPushStatus('error'); setTimeout(() => setPushStatus('idle'), 3000) }
  }, [content, reloadPreview])

  // Load on mount
  useEffect(() => {
    fetch('/api/portal/website').then(r => r.json()).then(data => {
      if (data?.schema) {
        setSchema(data.schema as TemplateSchema);
        (window as Window & { __schema?: TemplateSchema }).__schema = data.schema
        const withDefaults = applySchemaDefaults(data.content ?? {}, data.schema)
        setContent(withDefaults)
        pushToPreview(withDefaults)
      } else if (data?.content) {
        setContent(data.content as ContentBlock)
        pushToPreview(data.content as ContentBlock)
      }
      setPublishedContent((data?.published_content ?? {}) as ContentBlock)
      if (data?.has_draft)    setHasDraft(true)
      if (data?.site_url)     setSiteUrl(data.site_url as string)
      if (data?.published_at) setPublishedAt(data.published_at as string)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Listen for iframe messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'ngfReady') {
        iframeRef.current?.contentWindow?.postMessage({ type: 'setEditMode', enabled: true }, '*')
        setTimeout(() => {
          iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content }, '*')
        }, 50)
      }

      if (e.data?.type === 'fieldClick') {
        const { section, field, currentValue, elementRect } = e.data as {
          section: string; field: string; currentValue: string
          elementRect?: ClickField['elementRect']
        }
        const fieldPart  = field.split('.').pop() || field
        const fieldType  = resolveFieldType(schema, section, field)
        const iframeRect = iframeRef.current?.getBoundingClientRect() ?? new DOMRect()
        const pos        = computePopoverPosition(iframeRect, elementRect)

        setClickField({ section, field, value: currentValue, label: humanize(fieldPart), fieldType, elementRect })
        setPopoverPos(pos)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [content, schema])

  // ── States ────────────────────────────────────────────────────────────────

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
            <svg className="w-7 h-7 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <h2 className="text-base font-semibold text-gray-900 mb-2">Your website is coming soon</h2>
          <p className="text-sm text-gray-400 leading-relaxed">Once your site is live, you&apos;ll be able to edit content directly from here.</p>
        </div>
      </div>
    )
  }

  const normalizedSiteUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
  const changedSections   = getChangedSections(content, publishedContent, schema)
  const totalChanges      = changedSections.length

  const publishLabel =
    pushStatus === 'pushing'   ? 'Publishing…'
    : pushStatus === 'published' ? '✓ Published'
    : pushStatus === 'error'     ? 'Error — retry'
    : hasDraft                   ? 'Publish Changes'
    : 'Up to date'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">

      {/* ── Left sidebar (desktop) ── */}
      <aside className="hidden md:flex w-56 flex-col flex-shrink-0 bg-white border-r border-gray-100 overflow-hidden">

        {/* Site link + publish */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <a href={normalizedSiteUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-900 truncate flex-1 transition-colors min-w-0">
              {siteUrl.replace(/^https?:\/\//, '')}
            </a>
            <a href={normalizedSiteUrl} target="_blank" rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <button onClick={push} disabled={!hasDraft || pushStatus === 'pushing' || pushStatus === 'published'}
            className={`w-full h-9 rounded-xl text-sm font-semibold transition-all ${
              hasDraft && pushStatus === 'idle'   ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
              : pushStatus === 'pushing'          ? 'bg-blue-100 text-blue-400 cursor-wait'
              : pushStatus === 'published'        ? 'bg-emerald-100 text-emerald-700'
              : pushStatus === 'error'            ? 'bg-red-100 text-red-600 cursor-pointer'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}>
            {publishLabel}
          </button>

          {saveStatus !== 'idle' && (
            <p className={`text-center text-xs mt-1.5 ${
              saveStatus === 'saving' ? 'text-gray-400'
              : saveStatus === 'saved' ? 'text-emerald-600'
              : 'text-red-500'
            }`}>
              {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Draft saved' : 'Error saving'}
            </p>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-6">

          {/* Pending changes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Pending Changes
                {totalChanges > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold">
                    {totalChanges}
                  </span>
                )}
              </p>
              {totalChanges > 1 && (
                <button
                  onClick={revertAll}
                  className="text-[11px] text-gray-400 hover:text-red-500 transition-colors font-medium"
                >
                  Discard all
                </button>
              )}
            </div>
            {changedSections.length === 0 ? (
              <p className="text-xs text-gray-400 leading-relaxed">
                {hasDraft ? 'Loading changes…' : 'Everything is published.'}
              </p>
            ) : (
              <div className="space-y-1">
                {changedSections.map(({ sectionKey, label, fieldCount }) => (
                  <div key={sectionKey}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-100 group">
                    <div className="min-w-0">
                      <span className="text-xs font-medium text-amber-800">{label}</span>
                      <span className="text-xs text-amber-400 ml-1.5">{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
                    </div>
                    <button
                      onClick={() => revertSection(sectionKey)}
                      title="Discard changes"
                      className="ml-2 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-amber-400 hover:bg-red-100 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish history */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Last Published</p>
            {publishedAt ? (
              <div className="px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
                <p className="text-xs text-gray-600 font-medium">
                  {new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(publishedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Never published</p>
            )}
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-400 leading-relaxed">
            Click any text on the preview to edit it.
          </p>
        </div>
      </aside>

      {/* ── Preview pane ── */}
      <div className="flex-1 flex flex-col min-w-0 relative">

        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-2 px-4 h-11 bg-white border-b border-gray-100 flex-shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 truncate flex-1 min-w-0">{siteUrl.replace(/^https?:\/\//, '')}</span>
          {totalChanges > 0 && (
            <button onClick={() => setChangesOpen(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-xs font-medium text-amber-700">
              {totalChanges} change{totalChanges !== 1 ? 's' : ''}
            </button>
          )}
          <button onClick={push} disabled={!hasDraft || pushStatus === 'pushing'}
            className={`h-8 px-3 rounded-xl text-xs font-semibold transition-all flex-shrink-0 ${
              hasDraft && pushStatus === 'idle' ? 'bg-blue-600 text-white'
              : pushStatus === 'pushing'        ? 'bg-blue-100 text-blue-400'
              : pushStatus === 'published'      ? 'bg-emerald-100 text-emerald-700'
              : 'bg-gray-100 text-gray-400'
            }`}>
            {pushStatus === 'pushing' ? '…' : pushStatus === 'published' ? '✓' : hasDraft ? 'Publish' : '✓'}
          </button>
        </div>

        {/* Preview hint bar */}
        <div className="flex items-center justify-between gap-3 px-4 h-9 bg-gray-800 flex-shrink-0">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
          </div>
          <span className="text-xs text-white/50 flex-1 text-center truncate">
            Click any text in the preview to edit
          </span>
          <button onClick={reloadPreview}
            className="text-white/40 hover:text-white/80 transition-colors flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        {/* Iframe */}
        <div className="flex-1 bg-white">
          <iframe ref={iframeRef} src={normalizedSiteUrl} className="w-full h-full border-0" title="Website Preview" />
        </div>
      </div>

      {/* ── Click-to-edit popover ── */}
      {clickField && (
        <EditPopover
          field={clickField}
          position={popoverPos}
          onChange={(v) => updateField(clickField.section, clickField.field, v)}
          onDone={() => setClickField(null)}
          onCancel={() => {
            // Revert to original value on cancel
            setClickField(null)
          }}
        />
      )}

      {/* ── Mobile changes sheet ── */}
      {changesOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setChangesOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="flex justify-center mb-1">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Pending Changes</h3>
              <div className="flex items-center gap-2">
                {totalChanges > 1 && (
                  <button onClick={() => { revertAll(); setChangesOpen(false) }}
                    className="text-xs text-gray-400 hover:text-red-500 transition-colors font-medium">
                    Discard all
                  </button>
                )}
                <button onClick={push} disabled={!hasDraft || pushStatus === 'pushing'}
                  className={`h-8 px-4 rounded-xl text-xs font-semibold ${hasDraft ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {pushStatus === 'pushing' ? 'Publishing…' : 'Publish'}
                </button>
              </div>
            </div>
            {changedSections.length === 0 ? (
              <p className="text-sm text-gray-400">Everything is published.</p>
            ) : (
              <div className="space-y-2">
                {changedSections.map(({ sectionKey, label, fieldCount }) => (
                  <div key={sectionKey} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-amber-800">{label}</span>
                      <span className="text-xs text-amber-400 ml-1.5">{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
                    </div>
                    <button
                      onClick={() => revertSection(sectionKey)}
                      className="ml-3 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-amber-200 text-amber-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-base"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {publishedAt && (
              <p className="text-xs text-gray-400">
                Last published {new Date(publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {new Date(publishedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>
        </>
      )}

    </div>
  )
}
