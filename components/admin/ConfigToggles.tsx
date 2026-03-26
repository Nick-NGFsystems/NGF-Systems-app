'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ConfigValues {
  page_request: boolean
  page_website: boolean
  page_content: boolean
  page_invoices: boolean
  feature_blog: boolean
  feature_products: boolean
  feature_booking: boolean
  feature_gallery: boolean
}

interface ConfigTogglesProps {
  configId: string
  initialValues: ConfigValues
}

type ConfigField = keyof ConfigValues

interface ApiResponse {
  success: boolean
  error?: string
}

const PAGE_TOGGLES: { field: ConfigField; label: string }[] = [
  { field: 'page_request', label: 'Request Form' },
  { field: 'page_website', label: 'Website Overview' },
  { field: 'page_content', label: 'Content Editor' },
  { field: 'page_invoices', label: 'Invoices' },
]

const FEATURE_TOGGLES: { field: ConfigField; label: string }[] = [
  { field: 'feature_blog', label: 'Blog' },
  { field: 'feature_products', label: 'Products / Menu' },
  { field: 'feature_booking', label: 'Booking' },
  { field: 'feature_gallery', label: 'Gallery' },
]

function Toggle({
  enabled,
  saving,
  error,
  label,
  onToggle,
}: {
  enabled: boolean
  saving: boolean
  error: string | null
  label: string
  onToggle: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-900">{label}</p>
        {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={onToggle}
        disabled={saving}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          enabled ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  )
}

export default function ConfigToggles({ configId, initialValues }: ConfigTogglesProps) {
  const router = useRouter()
  const [values, setValues] = useState<ConfigValues>(initialValues)
  const [saving, setSaving] = useState<Partial<Record<ConfigField, boolean>>>({})
  const [errors, setErrors] = useState<Partial<Record<ConfigField, string>>>({})

  const handleToggle = async (field: ConfigField) => {
    const next = !values[field]

    // Optimistic update
    setValues((prev) => ({ ...prev, [field]: next }))
    setSaving((prev) => ({ ...prev, [field]: true }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))

    try {
      const response = await fetch(`/api/admin/client-configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        // Revert on error
        setValues((prev) => ({ ...prev, [field]: !next }))
        setErrors((prev) => ({ ...prev, [field]: result.error ?? 'Failed to save' }))
      } else {
        router.refresh()
      }
    } catch {
      // Revert on error
      setValues((prev) => ({ ...prev, [field]: !next }))
      setErrors((prev) => ({ ...prev, [field]: 'Failed to save' }))
    } finally {
      setSaving((prev) => ({ ...prev, [field]: false }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Pages</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {PAGE_TOGGLES.map(({ field, label }) => (
            <Toggle
              key={field}
              label={label}
              enabled={values[field]}
              saving={saving[field] ?? false}
              error={errors[field] ?? null}
              onToggle={() => handleToggle(field)}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400">Features</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FEATURE_TOGGLES.map(({ field, label }) => (
            <Toggle
              key={field}
              label={label}
              enabled={values[field]}
              saving={saving[field] ?? false}
              error={errors[field] ?? null}
              onToggle={() => handleToggle(field)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
