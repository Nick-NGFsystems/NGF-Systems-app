'use client'

import { useState } from 'react'

interface ContentField {
  id: string
  field_key: string
  field_type: string
  field_label: string
  field_value: string | null
  page_section: string
}

interface PortalContentEditorProps {
  initialFields: ContentField[]
}

export default function PortalContentEditor({ initialFields }: PortalContentEditorProps) {
  const [fields, setFields] = useState<ContentField[]>(initialFields)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [isSavingAll, setIsSavingAll] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function updateFieldValue(fieldId: string, value: string) {
    setFields((prev) => prev.map((item) => (item.id === fieldId ? { ...item, field_value: value } : item)))
  }

  async function uploadImageForField(fieldId: string, files: FileList | null) {
    if (!files || files.length === 0) return

    setError(null)
    setMessage(null)
    setSavingId(fieldId)

    try {
      const formData = new FormData()
      formData.append('file', files[0])

      const uploadResponse = await fetch('/api/portal/upload', {
        method: 'POST',
        body: formData,
      })

      const uploadResult = await uploadResponse.json()
      if (!uploadResponse.ok || !uploadResult.success) {
        setError(uploadResult.error || 'Failed to upload image')
        return
      }

      const url = uploadResult.data.url as string
      updateFieldValue(fieldId, url)

      await saveField(fieldId, url)
    } catch {
      setError('Failed to upload image')
    } finally {
      setSavingId(null)
    }
  }

  async function saveField(fieldId: string, explicitValue?: string) {
    const field = fields.find((item) => item.id === fieldId)
    if (!field) return

    const fieldValue = explicitValue ?? field.field_value ?? ''

    setError(null)
    setMessage(null)
    setSavingId(fieldId)

    try {
      const response = await fetch(`/api/portal/content/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field_value: fieldValue }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to save content field')
        return
      }

      setMessage('Field saved')
    } catch {
      setError('Failed to save content field')
    } finally {
      setSavingId(null)
    }
  }

  async function saveAllFields() {
    setError(null)
    setMessage(null)
    setIsSavingAll(true)

    try {
      for (const field of fields) {
        const response = await fetch(`/api/portal/content/${field.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field_value: field.field_value ?? '' }),
        })

        const result = await response.json()
        if (!response.ok || !result.success) {
          setError(result.error || `Failed to save ${field.field_label}`)
          return
        }
      }

      setMessage('All content saved')
    } catch {
      setError('Failed to save all fields')
    } finally {
      setIsSavingAll(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Editable Content</h2>
        <button
          type="button"
          onClick={saveAllFields}
          disabled={isSavingAll}
          className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {isSavingAll ? 'Saving...' : 'Save All'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <div className="space-y-4">
        {fields.map((field) => (
          <article key={field.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="mb-3">
              <p className="font-medium text-gray-900">{field.field_label}</p>
              <p className="text-xs text-gray-500">
                {field.field_key} • {field.page_section} • {field.field_type}
              </p>
            </div>

            {field.field_type === 'text' && (
              <input
                type="text"
                value={field.field_value ?? ''}
                onChange={(event) => updateFieldValue(field.id, event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}

            {field.field_type === 'url' && (
              <input
                type="url"
                value={field.field_value ?? ''}
                onChange={(event) => updateFieldValue(field.id, event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}

            {field.field_type === 'richtext' && (
              <textarea
                value={field.field_value ?? ''}
                onChange={(event) => updateFieldValue(field.id, event.target.value)}
                rows={5}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            )}

            {field.field_type === 'image' && (
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => void uploadImageForField(field.id, event.target.files)}
                  className="block w-full text-sm text-gray-600"
                />
                {field.field_value && (
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <img src={field.field_value} alt={field.field_label} className="h-40 w-full object-cover" />
                  </div>
                )}
              </div>
            )}

            <div className="mt-4">
              <button
                type="button"
                onClick={() => void saveField(field.id)}
                disabled={savingId === field.id}
                className="inline-flex h-10 items-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                {savingId === field.id ? 'Saving...' : 'Save Field'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
