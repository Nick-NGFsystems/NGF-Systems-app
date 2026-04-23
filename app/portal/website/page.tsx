'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Types mirror lib/website-schema.ts (kept in sync by hand; the schema is
// delivered over the wire from GET /api/portal/website).
// ─────────────────────────────────────────────────────────────────────────────

type FieldType = 'text' | 'textarea' | 'color' | 'image' | 'url' | 'email' | 'phone'

interface LeafField {
  type:         FieldType
  label:        string
  placeholder?: string
  help?:        string
  default?:     string
}

interface RepeatableField {
  type:        'repeatable'
  label:       string
  itemLabel:   string
  minItems?:   number
  maxItems?:   number
  fields:      Record<string, LeafField>
  defaultItem: Record<string, string>
}

type FieldDefinition = LeafField | RepeatableField

interface SectionSchema {
  label:        string
  description?: string
  fields:       Record<string, FieldDefinition>
}

interface SiteSchema {
  sections: Record<string, SectionSchema>
}

type SectionContent = Record<string, string | Array<Record<string, string>>>
type SiteContent    = Record<string, SectionContent>

// ─────────────────────────────────────────────────────────────────────────────

function normalizeUrl(u: string): string {
  return u.startsWith('http') ? u : `https://${u}`
}

// Deep clone for draft safety.
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T
}

export default function WebsiteEditorPage() {
  const [schema,           setSchema]           = useState<SiteSchema | null>(null)
  const [content,          setContent]          = useState<SiteContent>({})
  const [publishedContent, setPublishedContent] = useState<SiteContent>({})
  const [siteUrl,          setSiteUrl]          = useState<string | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [hasDraft,         setHasDraft]         = useState(false)
  const [publishedAt,      setPublishedAt]      = useState<string | null>(null)

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [pushStatus, setPushStatus] = useState<'idle' | 'pushing' | 'published' | 'error'>('idle')
  const [activeSection, setActiveSection] = useState<string | null>(null)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load once
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch('/api/portal/website', { cache: 'no-store' })
        const data = await res.json()
        if (data?.schema) setSchema(data.schema as SiteSchema)
        if (data?.content) setContent(data.content as SiteContent)
        if (data?.published_content) setPublishedContent(data.published_content as SiteContent)
        setHasDraft(!!data?.has_draft)
        setSiteUrl(data?.site_url ?? null)
        setPublishedAt(data?.published_at ?? null)

        // Default-open the first section
        if (data?.schema?.sections) {
          const firstKey = Object.keys(data.schema.sections)[0]
          if (firstKey) setActiveSection(firstKey)
        }
      } catch (err) {
        console.error('[editor] load failed', err)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // Debounced draft save
  const scheduleSave = useCallback((next: SiteContent) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/portal/website', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ content: next }),
        })
        if (res.ok) {
          setHasDraft(true)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 1500)
        } else {
          setSaveStatus('error')
          setTimeout(() => setSaveStatus('idle'), 3000)
        }
      } catch {
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 3000)
      }
    }, 700)
  }, [])

  // ── Mutators ─────────────────────────────────────────────────────────────

  const setField = useCallback((sectionKey: string, fieldKey: string, value: string) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] ?? {}) }
      section[fieldKey] = value
      const next = { ...prev, [sectionKey]: section }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const setItemField = useCallback((sectionKey: string, fieldKey: string, index: number, subKey: string, value: string) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] ?? {}) }
      const arr = Array.isArray(section[fieldKey]) ? [...(section[fieldKey] as Array<Record<string, string>>)] : []
      arr[index] = { ...(arr[index] ?? {}), [subKey]: value }
      section[fieldKey] = arr
      const next = { ...prev, [sectionKey]: section }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const addItem = useCallback((sectionKey: string, fieldKey: string, field: RepeatableField) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] ?? {}) }
      const arr = Array.isArray(section[fieldKey]) ? [...(section[fieldKey] as Array<Record<string, string>>)] : []
      if (field.maxItems && arr.length >= field.maxItems) return prev
      arr.push(clone(field.defaultItem))
      section[fieldKey] = arr
      const next = { ...prev, [sectionKey]: section }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const removeItem = useCallback((sectionKey: string, fieldKey: string, field: RepeatableField, index: number) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] ?? {}) }
      const arr = Array.isArray(section[fieldKey]) ? [...(section[fieldKey] as Array<Record<string, string>>)] : []
      if (field.minItems && arr.length <= field.minItems) return prev
      arr.splice(index, 1)
      section[fieldKey] = arr
      const next = { ...prev, [sectionKey]: section }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const moveItem = useCallback((sectionKey: string, fieldKey: string, from: number, to: number) => {
    setContent(prev => {
      const section = { ...(prev[sectionKey] ?? {}) }
      const arr = Array.isArray(section[fieldKey]) ? [...(section[fieldKey] as Array<Record<string, string>>)] : []
      if (to < 0 || to >= arr.length) return prev
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      section[fieldKey] = arr
      const next = { ...prev, [sectionKey]: section }
      scheduleSave(next)
      return next
    })
  }, [scheduleSave])

  const revertSection = useCallback((sectionKey: string) => {
    setContent(prev => {
      const next = { ...prev, [sectionKey]: clone(publishedContent[sectionKey] ?? {}) }
      scheduleSave(next)
      return next
    })
  }, [publishedContent, scheduleSave])

  const revertAll = useCallback(() => {
    if (!confirm('Discard all unpublished changes? This can not be undone.')) return
    const next = clone(publishedContent)
    setContent(next)
    scheduleSave(next)
  }, [publishedContent, scheduleSave])

  // ── Publish ──────────────────────────────────────────────────────────────

  const publish = useCallback(async () => {
    setPushStatus('pushing')
    try {
      // Force-save current draft first (don't race the debounce).
      const saveRes = await fetch('/api/portal/website', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ content }),
      })
      if (!saveRes.ok) throw new Error('save failed')

      const res = await fetch('/api/portal/website/push', { method: 'POST' })
      if (!res.ok) throw new Error('push failed')

      setPublishedContent(content)
      setHasDraft(false)
      setPublishedAt(new Date().toISOString())
      setPushStatus('published')
      setTimeout(() => setPushStatus('idle'), 2500)
    } catch (err) {
      console.error(err)
      setPushStatus('error')
      setTimeout(() => setPushStatus('idle'), 3000)
    }
  }, [content])

  // ── Derived ──────────────────────────────────────────────────────────────

  const changedSections = useMemo(() => {
    if (!schema) return [] as Array<{ sectionKey: string; label: string }>
    const out: Array<{ sectionKey: string; label: string }> = []
    for (const sectionKey of Object.keys(schema.sections)) {
      const a = JSON.stringify(content[sectionKey] ?? {})
      const b = JSON.stringify(publishedContent[sectionKey] ?? {})
      if (a !== b) {
        out.push({ sectionKey, label: schema.sections[sectionKey].label })
      }
    }
    return out
  }, [content, publishedContent, schema])

  // ── Render helpers ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading editor…</p>
        </div>
      </div>
    )
  }

  if (!schema) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Editor unavailable</h2>
          <p className="mt-2 text-sm text-gray-500">
            We couldn&apos;t load your schema. Refresh the page, or contact support if this keeps happening.
          </p>
        </div>
      </div>
    )
  }

  const sectionKeys = Object.keys(schema.sections)
  const activeSchema = activeSection ? schema.sections[activeSection] : null
  const activeContent = activeSection ? (content[activeSection] ?? {}) : {}
  const isChanged = (sectionKey: string) => changedSections.some(s => s.sectionKey === sectionKey)

  const publishLabel =
    pushStatus === 'pushing'   ? 'Publishing…' :
    pushStatus === 'published' ? 'Published' :
    pushStatus === 'error'     ? 'Error — retry' :
    hasDraft                   ? 'Publish changes' :
    'Up to date'

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-gray-50">

      {/* Left: section list + publish */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-100 p-4">
          <button
            type="button"
            onClick={publish}
            disabled={!hasDraft || pushStatus === 'pushing'}
            className={
              hasDraft && pushStatus === 'idle'
                ? 'w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800'
                : pushStatus === 'pushing'
                ? 'w-full cursor-wait rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-500'
                : pushStatus === 'published'
                ? 'w-full rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800'
                : pushStatus === 'error'
                ? 'w-full rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700'
                : 'w-full cursor-not-allowed rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-400'
            }
          >
            {publishLabel}
          </button>

          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
            <span>
              {saveStatus === 'saving' ? 'Saving…' :
               saveStatus === 'saved'  ? 'Draft saved' :
               saveStatus === 'error'  ? 'Save error' :
               hasDraft                 ? 'Draft' : 'Synced'}
            </span>
            {hasDraft && changedSections.length > 0 ? (
              <button
                type="button"
                onClick={revertAll}
                className="text-gray-400 hover:text-red-600"
              >
                Discard all
              </button>
            ) : null}
          </div>
          {publishedAt ? (
            <p className="mt-1 text-[11px] text-gray-400">
              Last published {new Date(publishedAt).toLocaleString()}
            </p>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {sectionKeys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveSection(key)}
              className={
                (activeSection === key
                  ? 'bg-slate-100 text-slate-900 '
                  : 'text-gray-700 hover:bg-gray-50 ') +
                'flex w-full items-center justify-between px-4 py-2 text-left text-sm'
              }
            >
              <span>{schema.sections[key].label}</span>
              {isChanged(key) ? (
                <span className="h-2 w-2 rounded-full bg-amber-500" title="Unpublished changes" />
              ) : null}
            </button>
          ))}
        </nav>

        {siteUrl ? (
          <div className="border-t border-gray-100 p-3">
            <a
              href={normalizeUrl(siteUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-gray-500 hover:text-slate-900"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="truncate">{siteUrl.replace(/^https?:\/\//, '')}</span>
            </a>
          </div>
        ) : null}
      </aside>

      {/* Middle: form */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {!activeSchema ? (
            <p className="text-sm text-gray-500">Pick a section to edit.</p>
          ) : (
            <section className="space-y-6">
              <header className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{activeSchema.label}</h1>
                  {activeSchema.description ? (
                    <p className="mt-1 text-sm text-gray-500">{activeSchema.description}</p>
                  ) : null}
                </div>
                {isChanged(activeSection!) ? (
                  <button
                    type="button"
                    onClick={() => revertSection(activeSection!)}
                    className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:border-red-300 hover:text-red-600"
                  >
                    Discard section
                  </button>
                ) : null}
              </header>

              <div className="space-y-5">
                {Object.entries(activeSchema.fields).map(([fieldKey, field]) => {
                  if (field.type === 'repeatable') {
                    const items = Array.isArray(activeContent[fieldKey])
                      ? (activeContent[fieldKey] as Array<Record<string, string>>)
                      : []
                    return (
                      <RepeatableEditor
                        key={fieldKey}
                        sectionKey={activeSection!}
                        fieldKey={fieldKey}
                        field={field}
                        items={items}
                        onSetItem={setItemField}
                        onAdd={() => addItem(activeSection!, fieldKey, field)}
                        onRemove={(i) => removeItem(activeSection!, fieldKey, field, i)}
                        onMove={(from, to) => moveItem(activeSection!, fieldKey, from, to)}
                      />
                    )
                  }
                  return (
                    <LeafEditor
                      key={fieldKey}
                      field={field}
                      value={typeof activeContent[fieldKey] === 'string' ? (activeContent[fieldKey] as string) : ''}
                      onChange={(v) => setField(activeSection!, fieldKey, v)}
                    />
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Right: live preview (read-only) */}
      <aside className="hidden w-[40%] flex-shrink-0 border-l border-gray-200 bg-white xl:flex xl:flex-col">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Live site</p>
          <span className="text-[11px] text-gray-400">
            Shows currently published version
          </span>
        </div>
        {siteUrl ? (
          <iframe
            src={normalizeUrl(siteUrl)}
            title="Live site preview"
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-gray-400">
            No site URL configured yet — admin can set this in your client config.
          </div>
        )}
      </aside>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Field components
// ─────────────────────────────────────────────────────────────────────────────

function LeafEditor({
  field,
  value,
  onChange,
}: {
  field: LeafField
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-900">{field.label}</span>
      {field.help ? <span className="mb-1.5 block text-xs text-gray-500">{field.help}</span> : null}

      {field.type === 'textarea' ? (
        <textarea
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      ) : field.type === 'color' ? (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value || '#2563EB'}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-12 cursor-pointer rounded-lg border border-gray-200 p-1"
          />
          <input
            type="text"
            value={value}
            placeholder="#2563EB"
            onChange={(e) => onChange(e.target.value)}
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        </div>
      ) : field.type === 'image' ? (
        <div className="space-y-2">
          <input
            type="url"
            value={value}
            placeholder="https://…"
            onChange={(e) => onChange(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={value}
              alt=""
              className="h-32 w-full rounded-lg border border-gray-100 bg-gray-50 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          ) : null}
        </div>
      ) : (
        <input
          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'url' ? 'url' : 'text'}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
      )}
    </label>
  )
}

function RepeatableEditor({
  sectionKey,
  fieldKey,
  field,
  items,
  onSetItem,
  onAdd,
  onRemove,
  onMove,
}: {
  sectionKey: string
  fieldKey:   string
  field:      RepeatableField
  items:      Array<Record<string, string>>
  onSetItem:  (sectionKey: string, fieldKey: string, index: number, subKey: string, value: string) => void
  onAdd:      () => void
  onRemove:   (index: number) => void
  onMove:     (from: number, to: number) => void
}) {
  const canAdd    = !field.maxItems || items.length < field.maxItems
  const canRemove = !field.minItems || items.length > field.minItems

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-900">{field.label}</p>
          <p className="text-xs text-gray-500">
            {items.length} {items.length === 1 ? field.itemLabel.toLowerCase() : `${field.itemLabel.toLowerCase()}s`}
            {field.maxItems ? ` (max ${field.maxItems})` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          + Add {field.itemLabel}
        </button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-xs text-gray-500">
          No {field.itemLabel.toLowerCase()}s yet. Click &ldquo;Add {field.itemLabel}&rdquo; to add one.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, i) => (
            <li key={i} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {field.itemLabel} {i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(i, i - 1)}
                    disabled={i === 0}
                    title="Move up"
                    className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMove(i, i + 1)}
                    disabled={i === items.length - 1}
                    title="Move down"
                    className="rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    disabled={!canRemove}
                    title="Remove"
                    className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(field.fields).map(([subKey, subField]) => (
                  <LeafEditor
                    key={subKey}
                    field={subField}
                    value={item[subKey] ?? ''}
                    onChange={(v) => onSetItem(sectionKey, fieldKey, i, subKey, v)}
                  />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
