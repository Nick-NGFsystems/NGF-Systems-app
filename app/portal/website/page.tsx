'use client'
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'

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
  /** How many items the live site is currently SSR-rendering. Editor uses
   *  this as the initial array length so the sidebar shows the same rows
   *  the client's site is already rendering from its hardcoded defaults. */
  initialItemCount?: number
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
        // Prefer saved content. Otherwise use whichever is larger between
        // minItems and the SSR-rendered count (initialItemCount) so the
        // sidebar shows as many rows as the live site is already displaying.
        const initialLength = Math.max(
          field.minItems ?? 0,
          field.initialItemCount ?? 0,
          1,
        )
        sectionData[fieldKey] = Array.isArray(existing[fieldKey]) && existing[fieldKey].length > 0
          ? existing[fieldKey]
          : Array.from({ length: initialLength }, () => ({ ...field.defaultItem }))
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

// ── Sections Accordion ────────────────────────────────────────────────────────
// One collapsible row per scraped section. Shows every scalar field as a
// labeled tile with its current value previewed, and every repeatable group
// as a nested list of items with up/down/× controls + an "Add" button. The
// whole point: the client sees what's on each page without hunting.

function SectionsAccordion({
  schema, content, siteValues, openSections, setOpenSections,
  openFieldEditor, scrollToField, addGroupItem, removeGroupItem, moveGroupItem,
  showAllFields, setShowAllFields,
}: {
  schema: TemplateSchema
  content: ContentBlock
  siteValues: Record<string, string>
  openSections: Record<string, boolean>
  setOpenSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  openFieldEditor: (sectionKey: string, fieldPath: string, currentValue: string, label: string, fieldType: FieldType) => void
  scrollToField: (sectionKey: string, fieldKey?: string) => void
  addGroupItem: (sectionKey: string, arrayKey: string) => void
  removeGroupItem: (sectionKey: string, arrayKey: string, index: number) => void
  moveGroupItem: (sectionKey: string, arrayKey: string, from: number, to: number) => void
  showAllFields: boolean
  setShowAllFields: (v: boolean) => void
}) {
  const preview = (sectionKey: string, fieldPath: string): string => {
    const sec = content[sectionKey] as Record<string, unknown> | undefined
    if (fieldPath.includes('.')) {
      const [arrayKey, idxStr, subKey] = fieldPath.split('.')
      const arr = Array.isArray(sec?.[arrayKey]) ? sec[arrayKey] as unknown[] : []
      const row = arr[parseInt(idxStr)] as Record<string, unknown> | undefined
      const v = row?.[subKey]
      if (typeof v === 'string' && v !== '') return v
    } else {
      const v = sec?.[fieldPath]
      if (typeof v === 'string' && v !== '') return v
    }
    return siteValues[`${sectionKey}.${fieldPath}`] ?? ''
  }

  const isImageLike = (v: string) =>
    v.startsWith('http') || v.startsWith('/') || v.startsWith('data:')

  // Count how many fields in a section have a rendered value we can preview.
  // Sections with zero surface area (e.g. a Brand section containing only
  // empty sr-only anchors that nothing else populates) are hidden so the
  // sidebar never shows mystery empty boxes.
  const fieldHasValue = (sectionKey: string, fieldKey: string, field: FieldDefinition): boolean => {
    if (field.type === 'repeatable') {
      const items = Array.isArray((content[sectionKey] as Record<string, unknown>)?.[fieldKey])
        ? (content[sectionKey] as Record<string, unknown>)[fieldKey] as Record<string, string>[]
        : []
      if (items.length > 0) return true
      // Check scraped site values — if any item's sub-field has a rendered value, keep it.
      return Object.keys(siteValues).some(k => k.startsWith(`${sectionKey}.${fieldKey}.`) && siteValues[k])
    }
    return Boolean(preview(sectionKey, fieldKey))
  }

  const sectionHasContent = (sectionKey: string, section: SectionSchema): boolean =>
    Object.entries(section.fields).some(([fk, f]) => fieldHasValue(sectionKey, fk, f))

  const sectionHasRepeatable = (section: SectionSchema): boolean =>
    Object.values(section.fields).some(f => f.type === 'repeatable')

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          {showAllFields ? 'Sections' : 'Manage Sections'}
        </p>
        {/* Toggle: default is the compact "Manage Sections" view which only
            shows repeatable groups (add/remove/reorder cards — things you
            can't do from clicking the page). Flip to "Show all fields" to
            also edit scalar text/image fields from the sidebar. */}
        <button
          type="button"
          role="switch"
          aria-checked={showAllFields}
          onClick={() => setShowAllFields(!showAllFields)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 hover:text-gray-900"
          title={showAllFields ? 'Hide scalar fields (click on the page to edit text instead)' : 'Also edit every text/image field from the sidebar'}
        >
          <span className={`inline-flex h-4 w-7 items-center rounded-full transition-colors ${showAllFields ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`inline-block h-3 w-3 rounded-full bg-white transition-transform ${showAllFields ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
          </span>
          <span>Show all fields</span>
        </button>
      </div>

      {!showAllFields && (
        <p className="mb-3 text-[10px] text-gray-400 leading-relaxed">
          Click text on the preview to edit it. Use this panel to add, remove, or reorder cards.
        </p>
      )}

      <div className="space-y-2">
        {Object.entries(schema.sections)
          // Default view hides text-only sections; "Show all" unhides them.
          .filter(([sectionKey, section]) =>
            sectionHasContent(sectionKey, section) &&
            (showAllFields || sectionHasRepeatable(section))
          )
          .map(([sectionKey, section]) => {
          // In compact (Manage Sections) mode, auto-open every section so
          // the card lists are immediately visible — there's nothing else
          // to show, so no point keeping them collapsed by default.
          const isOpen = showAllFields
            ? (openSections[sectionKey] ?? false)
            : (openSections[sectionKey] ?? true)
          const toggle = () =>
            setOpenSections(s => ({ ...s, [sectionKey]: !isOpen }))

          return (
            <div key={sectionKey} className="rounded-lg border border-gray-100 bg-white overflow-hidden">
              <button
                type="button"
                onClick={toggle}
                className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <span className="text-xs font-semibold text-gray-800 truncate">{section.label}</span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-gray-400">
                    {Object.entries(section.fields).filter(([fk, f]) => fieldHasValue(sectionKey, fk, f)).length}
                  </span>
                  <span className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                </span>
              </button>

              {isOpen && (
                <div className="p-2 space-y-2">
                  {Object.entries(section.fields)
                    .filter(([fk, f]) =>
                      fieldHasValue(sectionKey, fk, f) &&
                      // In compact mode (showAllFields=false), only show
                      // repeatable groups — scalar fields are edited on the
                      // page via click-to-edit.
                      (showAllFields || f.type === 'repeatable')
                    )
                    .map(([fieldKey, field]) => {
                    if (field.type === 'repeatable') {
                      const items = Array.isArray((content[sectionKey] as Record<string, unknown>)?.[fieldKey])
                        ? ((content[sectionKey] as Record<string, unknown>)[fieldKey] as Record<string, string>[])
                        : []
                      const canAdd    = items.length < (field.maxItems ?? 99)
                      const canRemove = items.length > (field.minItems ?? 0)
                      return (
                        <div key={fieldKey} className="rounded-md border border-gray-100 bg-gray-50/50 p-2">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{field.label}</span>
                            <span className="text-[10px] text-gray-400">{items.length}/{field.maxItems ?? 99}</span>
                          </div>
                          <div className="space-y-1.5">
                            {items.map((item, i) => {
                              const subFields = Object.entries(field.fields) as [string, LeafField][]
                              // Pick the most descriptive preview: first non-image field, then any image
                              const textSub = subFields.find(([, f]) => f.type !== 'image')
                              const imgSub  = subFields.find(([, f]) => f.type === 'image')
                              const previewText = textSub ? preview(sectionKey, `${fieldKey}.${i}.${textSub[0]}`) : ''
                              const previewImg  = imgSub  ? preview(sectionKey, `${fieldKey}.${i}.${imgSub[0]}`)  : ''
                              return (
                                <div key={i} className="rounded border border-gray-200 bg-white">
                                  <div className="flex items-start gap-1.5 p-1.5">
                                    {previewImg && isImageLike(previewImg) && (
                                      <img src={previewImg} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0 bg-gray-100" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[10px] text-gray-400 font-medium">{field.itemLabel} {i + 1}</p>
                                      <p className="text-xs text-gray-700 truncate">{previewText || '(empty)'}</p>
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {subFields.map(([subKey, subField]) => (
                                          <button
                                            key={subKey}
                                            type="button"
                                            onClick={() => openFieldEditor(
                                              sectionKey,
                                              `${fieldKey}.${i}.${subKey}`,
                                              preview(sectionKey, `${fieldKey}.${i}.${subKey}`),
                                              subField.label,
                                              subField.type as FieldType,
                                            )}
                                            className="inline-flex h-6 items-center px-2 rounded text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                                          >
                                            {subField.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex flex-col gap-0.5 flex-shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => moveGroupItem(sectionKey, fieldKey, i, Math.max(0, i - 1))}
                                        disabled={i === 0}
                                        title="Move up"
                                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                                      >↑</button>
                                      <button
                                        type="button"
                                        onClick={() => moveGroupItem(sectionKey, fieldKey, i, Math.min(items.length - 1, i + 1))}
                                        disabled={i === items.length - 1}
                                        title="Move down"
                                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-25"
                                      >↓</button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (canRemove && confirm(`Remove ${field.itemLabel} ${i + 1}?`)) {
                                            removeGroupItem(sectionKey, fieldKey, i)
                                          }
                                        }}
                                        disabled={!canRemove}
                                        title={canRemove ? 'Remove' : `At least ${field.minItems ?? 0} required`}
                                        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:bg-red-100 hover:text-red-500 disabled:opacity-25"
                                      >×</button>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const firstSub = subFields[0]?.[0]
                                      if (firstSub) scrollToField(sectionKey, `${fieldKey}.${i}.${firstSub}`)
                                    }}
                                    className="w-full px-1.5 pb-1 text-[10px] text-gray-400 hover:text-blue-600 text-left"
                                  >
                                    Show in preview →
                                  </button>
                                </div>
                              )
                            })}
                            <button
                              type="button"
                              onClick={() => addGroupItem(sectionKey, fieldKey)}
                              disabled={!canAdd}
                              className="w-full h-8 rounded-md text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-40"
                            >
                              {canAdd ? `+ Add ${field.itemLabel}` : `Max ${field.maxItems ?? 99} reached`}
                            </button>
                          </div>
                        </div>
                      )
                    }

                    // Scalar field — label + inline preview + edit button
                    const val = preview(sectionKey, fieldKey)
                    const isImg = field.type === 'image' && isImageLike(val)
                    return (
                      <button
                        key={fieldKey}
                        type="button"
                        onClick={() => openFieldEditor(sectionKey, fieldKey, val, field.label, field.type as FieldType)}
                        className="w-full flex items-start gap-2 px-2 py-1.5 rounded-md border border-gray-100 hover:bg-gray-50 text-left"
                      >
                        {isImg && <img src={val} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0 bg-gray-100" />}
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{field.label}</p>
                          <p className="text-xs text-gray-700 truncate">
                            {isImg ? (val ? 'Image set' : '(no image)') : (val || '(empty)')}
                          </p>
                        </div>
                        <span className="text-[10px] text-blue-600 mt-0.5">Edit</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Image field (URL + upload button + preview) ──────────────────────────────

function ImageField({
  value, onChange, inputRef,
}: {
  value: string
  onChange: (v: string) => void
  inputRef: React.Ref<HTMLInputElement>
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Front-line validation so we never send a file the server will reject.
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    if (!ALLOWED.includes(file.type)) {
      setUploadError(`Only JPG, PNG, WebP, GIF, or SVG images are supported (got ${file.type || 'unknown'}).`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max is 5 MB.`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/portal/upload', { method: 'POST', body: formData })

      // Parse the body as text first so we can surface non-JSON error pages
      // (e.g. Vercel's 413 Request Too Large, or a 502 from Blob storage).
      const bodyText = await res.text()
      let data: { success?: boolean; data?: { url?: string }; error?: string } = {}
      try { data = bodyText ? JSON.parse(bodyText) : {} } catch {
        setUploadError(`Upload failed (HTTP ${res.status}): ${bodyText.slice(0, 120) || 'no response body'}`)
        return
      }
      if (!res.ok || !data.success || !data.data?.url) {
        setUploadError(data.error ?? `Upload failed (HTTP ${res.status})`)
        return
      }
      onChange(data.data.url)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed — network error')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        placeholder="https://… or use Upload"
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="h-9 px-3 rounded-lg text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload from computer'}
        </button>
        {uploadError && <span className="text-xs text-red-600">{uploadError}</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>
      {value && (
        <img
          src={value}
          alt=""
          className="w-full h-32 object-cover rounded-xl bg-gray-100"
          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
        />
      )}
    </div>
  )
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

  // The popover now always centers on the viewport at a comfortable size
  // instead of trying to anchor next to the clicked element (which forced
  // a cramped 320 px box near the iframe edge). Mobile still gets a bottom
  // sheet that fills the width.
  const wrapperStyle: React.CSSProperties = position.isSheet
    ? { position: 'fixed', bottom: 0, left: 0, right: 0, borderRadius: '20px 20px 0 0', zIndex: 60, maxHeight: '90vh' }
    : {
        position:  'fixed',
        top:       '50%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        width:     'min(640px, calc(100vw - 48px))',
        maxHeight: 'calc(100vh - 64px)',
        borderRadius: 20,
        zIndex:    60,
      }

  // Textarea auto-grows with content, capped at ~60 vh so the window
  // doesn't push off-screen for very long passages.
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => {
    const el = taRef.current
    if (el && field.fieldType === 'textarea') {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.6)) + 'px'
    }
  }, [value, field.fieldType])

  return (
    <>
      {/* Scrim */}
      <div
        className="fixed inset-0 z-50"
        style={{ background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)' }}
        onClick={onCancel}
      />

      {/* Card */}
      <div style={wrapperStyle} className="bg-white shadow-2xl border border-black/8 overflow-hidden flex flex-col">
        {/* Handle (sheet only) */}
        {position.isSheet && (
          <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
            <div className="w-10 h-1 rounded-full bg-gray-200" />
          </div>
        )}

        {/* Header */}
        <div className="px-6 pt-5 pb-3 flex items-start justify-between gap-3 flex-shrink-0 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              {humanize(field.section)}
            </p>
            <p className="text-lg font-semibold text-gray-900 mt-0.5 truncate">{field.label}</p>
          </div>
          <button
            onClick={onCancel}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-xl leading-none flex-shrink-0 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body (scrollable if content is very long) */}
        <div className="px-6 py-4 space-y-3 overflow-y-auto flex-1 min-h-0">
          {field.fieldType === 'color' ? (
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={value || '#3B82F6'}
                onChange={e => handleChange(e.target.value)}
                className="w-14 h-14 rounded-xl border border-gray-200 cursor-pointer p-0.5 bg-transparent"
              />
              <input
                type="text"
                value={value || ''}
                onChange={e => handleChange(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : field.fieldType === 'image' ? (
            <ImageField value={value} onChange={handleChange} inputRef={inputRef as React.Ref<HTMLInputElement>} />
          ) : field.fieldType === 'textarea' ? (
            <textarea
              ref={(el) => {
                taRef.current = el
                ;(inputRef as React.MutableRefObject<HTMLTextAreaElement | HTMLInputElement | null>).current = el
              }}
              value={value || ''}
              rows={8}
              onChange={e => handleChange(e.target.value)}
              style={{ minHeight: '12rem' }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-[15px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              placeholder="Type here…"
            />
          ) : (
            <input
              ref={inputRef as React.Ref<HTMLInputElement>}
              type="text"
              value={value || ''}
              onChange={e => handleChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onDone() }}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Type here…"
            />
          )}

          {/* Character count for text-y fields */}
          {(field.fieldType === 'text' || field.fieldType === 'textarea') && (
            <p className="text-[11px] text-gray-400 text-right">{(value ?? '').length} characters</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-3 flex-shrink-0 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl text-sm font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onDone}
            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Done
          </button>
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
  // Snapshot of content[section][field] captured when a popover opens.
  // Lets Cancel restore the true pre-edit state (which may be undefined/'',
  // different from clickField.value which mirrors the DOM's SSR text).
  const preEditValue = useRef<string | boolean | undefined>(undefined)

  const [content,          setContent]          = useState<ContentBlock>({})
  const [publishedContent, setPublishedContent] = useState<ContentBlock>({})
  // Flat dot-notation map of every field's currently-rendered value on the
  // live site (text for text/textarea, src for images). Used for sidebar
  // previews so row labels show real review quotes / project names instead
  // of empty slots. Never written to the DB.
  const [siteValues,       setSiteValues]        = useState<Record<string, string>>({})
  // Sidebar width — drag handle adjusts in real time, persisted to
  // localStorage so the preference carries across sessions.
  const [sidebarWidth,     setSidebarWidth]      = useState<number>(() => {
    if (typeof window === 'undefined') return 380
    const saved = Number(window.localStorage.getItem('ngfEditorSidebarWidth'))
    return saved && saved >= 260 && saved <= 720 ? saved : 380
  })
  // Which section accordions are expanded. Starts with all sections expanded.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})
  // Which pending-change rows are expanded to show the per-field diff.
  const [expandedPending, setExpandedPending] = useState<Record<string, boolean>>({})
  // Whether the sidebar shows every scalar field (full form mode) or just
  // the repeatable groups (compact "Manage sections" mode, default).
  // Persisted so the client's preference survives reloads.
  const [showAllFields, setShowAllFields] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('ngfEditorShowAllFields') === '1'
  })
  useEffect(() => {
    try {
      window.localStorage.setItem('ngfEditorShowAllFields', showAllFields ? '1' : '0')
    } catch {}
  }, [showAllFields])
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

  // Version history panel state
  const [historyOpen,    setHistoryOpen]    = useState(false)
  const [versions,       setVersions]       = useState<{ id: string; published_at: string; note: string | null }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [revertingId,    setRevertingId]    = useState<string | null>(null)

  // Published content with schema defaults applied — used as the baseline for
  // "pending changes" comparison. This prevents schema-initialized empty strings
  // from showing as changes when nothing has actually been edited yet.
  const baseContent = useMemo<ContentBlock>(
    () => schema ? applySchemaDefaults(publishedContent, schema) : publishedContent,
    [publishedContent, schema]
  )

  // Strip empty-string values before sending to the iframe bridge. When the
  // editor has no saved content yet, applySchemaDefaults fills every field
  // with '' — if we push those, the bridge overwrites the site's actual
  // rendered text with empty placeholders. We want the site's native content
  // to stay visible until the user types something.
  //
  // Also drops whole sections that have only empty values. Array items keep
  // their structure but drop empty strings inside them.
  const stripEmpty = useCallback((c: ContentBlock): ContentBlock => {
    const out: ContentBlock = {}
    for (const [sectionKey, sectionValue] of Object.entries(c ?? {})) {
      if (!sectionValue || typeof sectionValue !== 'object') continue
      const section: Record<string, unknown> = {}
      for (const [fieldKey, fieldValue] of Object.entries(sectionValue as Record<string, unknown>)) {
        if (typeof fieldValue === 'string') {
          if (fieldValue !== '') section[fieldKey] = fieldValue
        } else if (Array.isArray(fieldValue)) {
          const cleaned = fieldValue.map((item) => {
            if (!item || typeof item !== 'object') return item
            const row: Record<string, unknown> = {}
            for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
              if (typeof v === 'string' && v === '') continue
              row[k] = v
            }
            return row
          })
          if (cleaned.length > 0) section[fieldKey] = cleaned
        } else if (fieldValue !== undefined && fieldValue !== null) {
          section[fieldKey] = fieldValue
        }
      }
      if (Object.keys(section).length > 0) out[sectionKey] = section
    }
    return out
  }, [])

  const pushToPreview = useCallback((c: ContentBlock) => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      // Send UNFILTERED content. The bridge treats '' as "restore to the
      // site's original SSR text" (via its captured data-ngf-default), so
      // reverts (cancel / X / revert-all) repaint cleanly without a reload.
      iframeRef.current?.contentWindow?.postMessage({ type: 'contentUpdate', content: c }, '*')
    }, 120)
  }, [])

  const scheduleSave = useCallback((c: ContentBlock) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        // Strip empty strings before persisting — keeps the DB from accumulating
        // '' entries from applySchemaDefaults. Client sites use `||` fallbacks,
        // so omitted keys fall through to hardcoded defaults.
        const filtered = stripEmpty(c)
        const res = await fetch('/api/portal/website', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: filtered }),
        })
        if (res.ok) { setHasDraft(true); setSaveStatus('saved') } else { setSaveStatus('error') }
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch { setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 2000) }
    }, 800)
  }, [stripEmpty])

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

  // Immediate flush used by every revert operation. Cancels the debounced
  // save and either POSTs the current draft OR — if the content equals the
  // baseline once empties are stripped — DELETEs the draft so has_draft
  // goes false and a refresh doesn't bring "phantom" pending changes back.
  const flushSaveOrClear = useCallback((next: ContentBlock) => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null }
    const filtered     = stripEmpty(next)
    const baseFiltered = stripEmpty(baseContent)
    const isClean      = JSON.stringify(filtered) === JSON.stringify(baseFiltered)

    setSaveStatus('saving')
    const req = isClean
      ? fetch('/api/portal/website', { method: 'DELETE' })
      : fetch('/api/portal/website', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: filtered }),
        })

    req.then(res => {
      if (!res.ok) { setSaveStatus('error'); return }
      setSaveStatus('saved')
      setHasDraft(!isClean)
      if (isClean) setExpandedPending({})
    }).catch(() => setSaveStatus('error'))
      .finally(() => setTimeout(() => setSaveStatus('idle'), 1500))
  }, [stripEmpty, baseContent])

  const revertSection = useCallback((sectionKey: string) => {
    setContent(prev => {
      const next = { ...prev, [sectionKey]: baseContent[sectionKey] ?? {} }
      pushToPreview(next)
      flushSaveOrClear(next)
      return next
    })
  }, [baseContent, pushToPreview, flushSaveOrClear])

  const revertAll = useCallback(() => {
    setContent(() => {
      const next = { ...baseContent }
      pushToPreview(next)
      flushSaveOrClear(next)
      return next
    })
  }, [baseContent, pushToPreview, flushSaveOrClear])

  const reloadPreview = useCallback(() => {
    if (iframeRef.current) iframeRef.current.src = iframeRef.current.src
  }, [])

  // Append a new item to a repeatable group: updates local state, tells the
  // bridge to clone + re-index the DOM card template, schedules save.
  const addGroupItem = useCallback((sectionKey: string, arrayKey: string) => {
    if (!schema) return
    const sec = schema.sections[sectionKey]
    const fieldDef = sec?.fields[arrayKey]
    if (!fieldDef || fieldDef.type !== 'repeatable') return
    setContent(prev => {
      const section = (prev[sectionKey] ?? {}) as Record<string, unknown>
      const existing = Array.isArray(section[arrayKey]) ? section[arrayKey] as unknown[] : []
      if (fieldDef.maxItems && existing.length >= fieldDef.maxItems) return prev
      const newIndex = existing.length
      const next = {
        ...prev,
        [sectionKey]: { ...section, [arrayKey]: [...existing, { ...fieldDef.defaultItem }] },
      }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'addGroupItem', group: `${sectionKey}.${arrayKey}`, newIndex },
        '*'
      )
      scheduleSave(next)
      return next
    })
  }, [schema, scheduleSave])

  // Move an item within a repeatable group from `from` to `to`. Swaps
  // indices in both content state and the iframe DOM so preview stays in sync.
  const moveGroupItem = useCallback((sectionKey: string, arrayKey: string, from: number, to: number) => {
    if (from === to) return
    setContent(prev => {
      const section = (prev[sectionKey] ?? {}) as Record<string, unknown>
      const existing = Array.isArray(section[arrayKey]) ? [...section[arrayKey] as unknown[]] : []
      if (from < 0 || from >= existing.length || to < 0 || to >= existing.length) return prev
      const [moved] = existing.splice(from, 1)
      existing.splice(to, 0, moved)
      const next = { ...prev, [sectionKey]: { ...section, [arrayKey]: existing } }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'moveGroupItem', group: `${sectionKey}.${arrayKey}`, from, to },
        '*'
      )
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  // Remove an item at index from a repeatable group: updates state, tells the
  // bridge to remove the DOM card and shift subsequent indices, schedules save.
  const removeGroupItem = useCallback((sectionKey: string, arrayKey: string, index: number) => {
    if (!schema) return
    const sec = schema.sections[sectionKey]
    const fieldDef = sec?.fields[arrayKey]
    if (!fieldDef || fieldDef.type !== 'repeatable') return
    setContent(prev => {
      const section = (prev[sectionKey] ?? {}) as Record<string, unknown>
      const existing = Array.isArray(section[arrayKey]) ? section[arrayKey] as unknown[] : []
      if (fieldDef.minItems && existing.length <= fieldDef.minItems) return prev
      const updated = existing.filter((_, i) => i !== index)
      const next = { ...prev, [sectionKey]: { ...section, [arrayKey]: updated } }
      iframeRef.current?.contentWindow?.postMessage(
        { type: 'removeGroupItem', group: `${sectionKey}.${arrayKey}`, index },
        '*'
      )
      scheduleSave(next)
      return next
    })
  }, [schema, scheduleSave])

  // Helper: list all (section, array) repeatable pairs from the schema so the
  // sidebar can render one control panel per group.
  const repeatableGroups = useMemo(() => {
    if (!schema) return [] as { section: string; arrayKey: string; label: string; itemLabel: string; minItems: number; maxItems: number }[]
    const out: { section: string; arrayKey: string; label: string; itemLabel: string; minItems: number; maxItems: number }[] = []
    for (const [section, sec] of Object.entries(schema.sections)) {
      for (const [fk, field] of Object.entries(sec.fields)) {
        if (field.type === 'repeatable') {
          out.push({
            section, arrayKey: fk,
            label:     sec.label + ' · ' + field.label,
            itemLabel: field.itemLabel,
            minItems:  field.minItems ?? 0,
            maxItems:  field.maxItems ?? 99,
          })
        }
      }
    }
    return out
  }, [schema])

  const loadVersions = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const res = await fetch('/api/portal/website/versions')
      if (res.ok) {
        const data = (await res.json()) as { versions: { id: string; published_at: string; note: string | null }[] }
        setVersions(data.versions ?? [])
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  // Load history lazily the first time the panel is opened.
  useEffect(() => {
    if (historyOpen && versions.length === 0 && !historyLoading) {
      void loadVersions()
    }
  }, [historyOpen, versions.length, historyLoading, loadVersions])

  const revertToVersion = useCallback(async (versionId: string) => {
    const ok = window.confirm(
      'Revert the live website to this version? Your current published content will be auto-snapshotted before the swap so you can come back to it.'
    )
    if (!ok) return
    setRevertingId(versionId)
    try {
      const res = await fetch('/api/portal/website/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId }),
      })
      if (res.ok) {
        await loadVersions()
        reloadPreview()
        // Also reload editor state so content/publishedAt resync.
        location.reload()
      } else {
        alert('Revert failed — please try again.')
      }
    } finally {
      setRevertingId(null)
    }
  }, [loadVersions, reloadPreview])

  // Ask the iframe to scroll a specific field into view and flash-highlight it.
  const scrollToField = useCallback((sectionKey: string, fieldKey?: string) => {
    const path = fieldKey ? `${sectionKey}.${fieldKey}` : sectionKey
    iframeRef.current?.contentWindow?.postMessage({ type: 'scrollToField', path }, '*')
  }, [])

  // Open the edit popover for a field directly from the sidebar. Synthesizes
  // the same clickField state the iframe's `fieldClick` postMessage would.
  const openFieldEditor = useCallback((sectionKey: string, fieldPath: string, currentValue: string, label: string, fieldType: FieldType) => {
    // Snapshot pre-edit value (mirrors the fieldClick handler logic)
    const sectionData = content[sectionKey] as Record<string, unknown> | undefined
    if (fieldPath.includes('.')) {
      const [arrayKey, idxStr, subKey] = fieldPath.split('.')
      const arr = Array.isArray(sectionData?.[arrayKey]) ? sectionData[arrayKey] as unknown[] : []
      const row = arr[parseInt(idxStr)] as Record<string, unknown> | undefined
      preEditValue.current = row?.[subKey] as string | boolean | undefined
    } else {
      preEditValue.current = sectionData?.[fieldPath] as string | boolean | undefined
    }
    // Center popover (no anchor from iframe — render as centered sheet)
    const vw = typeof window !== 'undefined' ? window.innerWidth  : 1024
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768
    setPopoverPos({ top: Math.max(80, vh / 2 - 160), left: Math.max(24, vw / 2 - 160), isSheet: vw < 640 })
    setClickField({ section: sectionKey, field: fieldPath, value: currentValue, label, fieldType })
    scrollToField(sectionKey, fieldPath)
  }, [content, scrollToField])

  // First field in a section that differs from the baseline — used as the
  // scroll target when the user clicks a pending-change row.
  const firstChangedFieldOf = useCallback((sectionKey: string): string | undefined => {
    if (!schema) return undefined
    const sec = schema.sections[sectionKey]
    if (!sec) return undefined
    const curr = (content[sectionKey] ?? {}) as Record<string, unknown>
    const base = (baseContent[sectionKey] ?? {}) as Record<string, unknown>
    for (const [fk, fieldDef] of Object.entries(sec.fields)) {
      if (fieldDef.type === 'repeatable') {
        const ca = Array.isArray(curr[fk]) ? curr[fk] as unknown[] : []
        const ba = Array.isArray(base[fk]) ? base[fk] as unknown[] : []
        const max = Math.max(ca.length, ba.length)
        for (let i = 0; i < max; i++) {
          const ci = (ca[i] ?? {}) as Record<string, unknown>
          const bi = (ba[i] ?? {}) as Record<string, unknown>
          for (const subKey of Object.keys({ ...ci, ...bi })) {
            if (JSON.stringify(ci[subKey]) !== JSON.stringify(bi[subKey])) {
              return `${fk}.${i}.${subKey}`
            }
          }
        }
      } else if (JSON.stringify(curr[fk]) !== JSON.stringify(base[fk])) {
        return fk
      }
    }
    return undefined
  }, [schema, content, baseContent])

  // Full list of every changed field within a section, with before/after
  // values and metadata the diff UI needs (label, type, path). Returned in
  // source order from the schema.
  interface PendingFieldDiff {
    path:     string            // e.g. "headline" or "items.2.title"
    label:    string
    type:     FieldType
    before:   string            // stringified for easy diff display
    after:    string
    added?:   boolean           // true when a repeatable item is newly added
    removed?: boolean           // true when a repeatable item was removed
    itemLabel?: string          // "Service", "Review" etc. (for grouped items)
    itemIndex?: number
  }
  const changedFieldsOfSection = useCallback((sectionKey: string): PendingFieldDiff[] => {
    if (!schema) return []
    const sec = schema.sections[sectionKey]
    if (!sec) return []
    const curr = (content[sectionKey] ?? {}) as Record<string, unknown>
    const base = (baseContent[sectionKey] ?? {}) as Record<string, unknown>
    const toStr = (v: unknown): string => {
      if (v === undefined || v === null) return ''
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
      return JSON.stringify(v)
    }
    const diffs: PendingFieldDiff[] = []
    for (const [fk, fieldDef] of Object.entries(sec.fields)) {
      if (fieldDef.type === 'repeatable') {
        const ca = Array.isArray(curr[fk]) ? curr[fk] as unknown[] : []
        const ba = Array.isArray(base[fk]) ? base[fk] as unknown[] : []
        const max = Math.max(ca.length, ba.length)
        for (let i = 0; i < max; i++) {
          const added   = i >= ba.length
          const removed = i >= ca.length
          if (added) {
            diffs.push({
              path: `${fk}.${i}`, label: fieldDef.itemLabel, type: 'text' as FieldType,
              before: '', after: `New ${fieldDef.itemLabel.toLowerCase()}`,
              added: true, itemLabel: fieldDef.itemLabel, itemIndex: i,
            })
            continue
          }
          if (removed) {
            diffs.push({
              path: `${fk}.${i}`, label: fieldDef.itemLabel, type: 'text' as FieldType,
              before: `${fieldDef.itemLabel} ${i + 1}`, after: '',
              removed: true, itemLabel: fieldDef.itemLabel, itemIndex: i,
            })
            continue
          }
          const ci = (ca[i] ?? {}) as Record<string, unknown>
          const bi = (ba[i] ?? {}) as Record<string, unknown>
          for (const [subKey, subField] of Object.entries(fieldDef.fields)) {
            const bStr = toStr(bi[subKey])
            const cStr = toStr(ci[subKey])
            if (bStr !== cStr) {
              diffs.push({
                path: `${fk}.${i}.${subKey}`,
                label: subField.label,
                type: subField.type as FieldType,
                before: bStr,
                after:  cStr,
                itemLabel: fieldDef.itemLabel,
                itemIndex: i,
              })
            }
          }
        }
      } else {
        const bStr = toStr(base[fk])
        const cStr = toStr(curr[fk])
        if (bStr !== cStr) {
          diffs.push({
            path:  fk,
            label: fieldDef.label,
            type:  fieldDef.type as FieldType,
            before: bStr,
            after:  cStr,
          })
        }
      }
    }
    return diffs
  }, [schema, content, baseContent])

  // Revert a single field back to its baseline value. Used when clicking the
  // × on a specific row inside the expanded pending-change diff.
  const revertField = useCallback((sectionKey: string, fieldPath: string) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] as Record<string, unknown> ?? {}) }
      const base    = (baseContent[sectionKey] as Record<string, unknown>) ?? {}
      if (fieldPath.includes('.')) {
        const [arrayKey, idxStr, subKey] = fieldPath.split('.')
        const currArr = Array.isArray(section[arrayKey]) ? [...section[arrayKey] as unknown[]] : []
        const baseArr = Array.isArray(base[arrayKey]) ? base[arrayKey] as unknown[] : []
        const idx = parseInt(idxStr, 10)
        if (subKey === undefined) {
          // Whole item added/removed — revert by matching baseline length.
          const next = { ...prev, [sectionKey]: { ...section, [arrayKey]: [...baseArr] } }
          pushToPreview(next)
          flushSaveOrClear(next)
          return next
        }
        const currRow = (currArr[idx] ?? {}) as Record<string, unknown>
        const baseRow = (baseArr[idx] ?? {}) as Record<string, unknown>
        currArr[idx] = { ...currRow, [subKey]: baseRow[subKey] ?? '' }
        section[arrayKey] = currArr
      } else {
        section[fieldPath] = (base as Record<string, unknown>)[fieldPath] ?? ''
      }
      const next = { ...prev, [sectionKey]: section }
      pushToPreview(next)
      flushSaveOrClear(next)
      return next
    })
  }, [baseContent, pushToPreview, flushSaveOrClear])

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
      if (data?.site_values)  setSiteValues(data.site_values as Record<string, string>)
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
          // Send unfiltered — the bridge captures each field's SSR default on
          // load and treats '' as "restore default", so empties don't wipe
          // the server-rendered text and edited values still paint through.
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

        // Snapshot the TRUE pre-edit value from content state (may be '' or
        // undefined for an unpopulated field). clickField.value below is the
        // DOM text which differs when the site is showing a hardcoded fallback.
        const sectionData = content[section] as Record<string, unknown> | undefined
        if (field.includes('.')) {
          const [arrayKey, idxStr, subKey] = field.split('.')
          const arr = Array.isArray(sectionData?.[arrayKey]) ? sectionData[arrayKey] as unknown[] : []
          const row = arr[parseInt(idxStr)] as Record<string, unknown> | undefined
          preEditValue.current = row?.[subKey] as string | boolean | undefined
        } else {
          preEditValue.current = sectionData?.[field] as string | boolean | undefined
        }

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
  const changedSections   = getChangedSections(content, baseContent, schema)
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

      {/* ── Left sidebar (desktop) — resizable via the drag handle on its right edge ── */}
      <aside
        className="hidden md:flex flex-col flex-shrink-0 bg-white border-r border-gray-100 overflow-hidden relative"
        style={{ width: sidebarWidth }}
      >

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
                {changedSections.map(({ sectionKey, label, fieldCount }) => {
                  const isExpanded = expandedPending[sectionKey] ?? false
                  const diffs = isExpanded ? changedFieldsOfSection(sectionKey) : []
                  return (
                    <div
                      key={sectionKey}
                      className="rounded-lg bg-amber-50 border border-amber-100 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-2.5 py-2 hover:bg-amber-100 group">
                        <button
                          type="button"
                          onClick={() => setExpandedPending(s => ({ ...s, [sectionKey]: !isExpanded }))}
                          className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                          title={isExpanded ? 'Hide changes' : 'Show what changed'}
                        >
                          <span className={`text-amber-500 text-[11px] transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                          <span className="text-xs font-medium text-amber-800 truncate">{label}</span>
                          <span className="text-xs text-amber-400 flex-shrink-0">{fieldCount} {fieldCount === 1 ? 'change' : 'changes'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            scrollToField(sectionKey, firstChangedFieldOf(sectionKey))
                          }}
                          title="Scroll to this change on the page"
                          className="ml-1 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded text-amber-600 hover:bg-amber-200 opacity-60 group-hover:opacity-100"
                        >↗</button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); revertSection(sectionKey) }}
                          title="Discard all changes in this section"
                          className="ml-0.5 flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full text-amber-400 hover:bg-red-100 hover:text-red-500 opacity-60 group-hover:opacity-100"
                        >×</button>
                      </div>

                      {isExpanded && (
                        <div className="border-t border-amber-200 bg-white/60 p-1.5 space-y-1">
                          {diffs.length === 0 ? (
                            <p className="text-[11px] text-amber-700/70 px-1.5 py-1">No field-level diffs — refresh.</p>
                          ) : diffs.map(d => {
                            const isImg = d.type === 'image'
                            const pretty = (v: string) => v === '' ? '(empty)' : v
                            return (
                              <div key={d.path} className="rounded border border-amber-100 bg-white p-1.5">
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wide truncate">
                                    {d.itemLabel ? `${d.itemLabel} ${(d.itemIndex ?? 0) + 1} · ` : ''}{d.label}
                                    {d.added   && <span className="ml-1 rounded bg-green-100 px-1 text-[9px] text-green-700">added</span>}
                                    {d.removed && <span className="ml-1 rounded bg-red-100 px-1 text-[9px] text-red-700">removed</span>}
                                  </span>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
                                    {!d.added && !d.removed && (
                                      <button
                                        type="button"
                                        onClick={() => openFieldEditor(sectionKey, d.path, d.after, d.label, d.type)}
                                        title="Edit this field"
                                        className="w-4 h-4 flex items-center justify-center rounded text-amber-600 hover:bg-amber-100 text-[10px]"
                                      >✎</button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => revertField(sectionKey, d.path)}
                                      title="Revert this field"
                                      className="w-4 h-4 flex items-center justify-center rounded text-amber-400 hover:bg-red-100 hover:text-red-500 text-[11px]"
                                    >×</button>
                                  </div>
                                </div>
                                {isImg ? (
                                  <div className="flex items-center gap-1.5">
                                    {d.before && <img src={d.before} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" />}
                                    <span className="text-[11px] text-gray-400">→</span>
                                    {d.after ? <img src={d.after} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" /> : <span className="text-[10px] text-gray-400">(cleared)</span>}
                                  </div>
                                ) : (
                                  <div className="text-[11px] leading-snug">
                                    <div className="text-gray-400 line-through truncate">{pretty(d.before)}</div>
                                    <div className="text-gray-800 truncate">{pretty(d.after)}</div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Sections — defaults to compact "Manage sections" (only repeatable
              groups). Toggle at the top flips to show every scalar field too. */}
          {schema && (
            <SectionsAccordion
              schema={schema}
              content={content}
              siteValues={siteValues}
              openSections={openSections}
              setOpenSections={setOpenSections}
              openFieldEditor={openFieldEditor}
              scrollToField={scrollToField}
              addGroupItem={addGroupItem}
              removeGroupItem={removeGroupItem}
              moveGroupItem={moveGroupItem}
              showAllFields={showAllFields}
              setShowAllFields={setShowAllFields}
            />
          )}

          {/* Publish history */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Last Published</p>
              <button
                type="button"
                onClick={() => setHistoryOpen(v => !v)}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
              >
                {historyOpen ? 'Hide history' : 'View history'}
              </button>
            </div>
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

            {historyOpen && (
              <div className="mt-2 space-y-1">
                {historyLoading && <p className="text-xs text-gray-400">Loading…</p>}
                {!historyLoading && versions.length === 0 && (
                  <p className="text-xs text-gray-400">No prior versions yet.</p>
                )}
                {versions.map(v => (
                  <div key={v.id} className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-gray-50 border border-gray-100">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-700 font-medium truncate">
                        {new Date(v.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {new Date(v.published_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </p>
                      {v.note && <p className="text-[10px] text-gray-400 truncate">{v.note}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => revertToVersion(v.id)}
                      className="ml-2 h-7 px-2.5 rounded-md text-[11px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100"
                      disabled={revertingId === v.id}
                    >
                      {revertingId === v.id ? 'Reverting…' : 'Revert'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Hint */}
          <p className="text-xs text-gray-400 leading-relaxed">
            Click any text on the preview to edit it.
          </p>
        </div>
      </aside>

      {/* Drag handle — pull right to widen the sidebar, left to shrink it.
          Persists width to localStorage across editor sessions.
          NOTE: we disable pointer-events on the iframe during the drag so it
          doesn't swallow pointermove events the moment the cursor crosses
          into it. Without that guard the drag only works within the few-
          pixel-wide handle itself. Also forces user-select:none on body so
          text selection doesn't hijack the interaction. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize editor sidebar (drag)"
        title="Drag to resize"
        onPointerDown={(e) => {
          e.preventDefault()
          const startX  = e.clientX
          const startW  = sidebarWidth
          let   latest  = startW
          const iframe  = iframeRef.current
          const prevCursor = document.body.style.cursor
          const prevSelect = document.body.style.userSelect
          document.body.style.cursor     = 'col-resize'
          document.body.style.userSelect = 'none'
          if (iframe) iframe.style.pointerEvents = 'none'

          const onMove = (ev: PointerEvent) => {
            latest = Math.min(720, Math.max(260, startW + (ev.clientX - startX)))
            setSidebarWidth(latest)
          }
          const onUp = () => {
            window.removeEventListener('pointermove', onMove)
            window.removeEventListener('pointerup',   onUp)
            window.removeEventListener('pointercancel', onUp)
            document.body.style.cursor     = prevCursor
            document.body.style.userSelect = prevSelect
            if (iframe) iframe.style.pointerEvents = ''
            try { localStorage.setItem('ngfEditorSidebarWidth', String(latest)) } catch {}
          }
          window.addEventListener('pointermove',   onMove)
          window.addEventListener('pointerup',     onUp)
          window.addEventListener('pointercancel', onUp)
        }}
        className="hidden md:flex w-2 flex-shrink-0 cursor-col-resize bg-gray-100 hover:bg-blue-400 active:bg-blue-500 transition-colors items-center justify-center group select-none"
        style={{ touchAction: 'none' }}
      >
        {/* Visual grip dots so it's obvious the handle is draggable */}
        <div className="flex flex-col gap-0.5 opacity-40 group-hover:opacity-80 pointer-events-none">
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
          <span className="w-0.5 h-0.5 rounded-full bg-gray-600" />
        </div>
      </div>

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
            // Restore the pre-edit value captured when the popover opened.
            // undefined means the field had no stored value — send '' so the
            // bridge repaints the server-rendered fallback.
            const restore = preEditValue.current
            const v = typeof restore === 'string' || typeof restore === 'boolean' ? restore : ''
            updateField(clickField.section, clickField.field, v)
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
                  <button
                    key={sectionKey}
                    type="button"
                    onClick={() => { scrollToField(sectionKey, firstChangedFieldOf(sectionKey)); setChangesOpen(false) }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-100 hover:bg-amber-100 text-left"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-amber-800">{label}</span>
                      <span className="text-xs text-amber-400 ml-1.5">{fieldCount} {fieldCount === 1 ? 'field' : 'fields'}</span>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); revertSection(sectionKey) }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); revertSection(sectionKey) } }}
                      className="ml-3 flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-white border border-amber-200 text-amber-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-colors text-base"
                    >
                      ×
                    </span>
                  </button>
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
