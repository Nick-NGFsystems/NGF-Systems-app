'use client'

import { useMemo, useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useConfirm } from '@/hooks/useConfirm'

interface PortalConfigState {
  page_request: boolean
  page_website: boolean
  page_content: boolean
  page_invoices: boolean
  feature_blog: boolean
  feature_products: boolean
  feature_booking: boolean
  feature_gallery: boolean
  booking_url: string
  database_url: string
  site_url: string
  site_repo: string
}

interface SiteContentField {
  id: string
  field_key: string
  field_label: string
  field_type: string
  page_section: string
  field_value: string | null
  created: string
  updated: string
}

interface ChangeRequestItem {
  id: string
  title: string
  description: string | null
  page_section: string | null
  priority: string
  status: string
  image_urls: string | null
  admin_comment: string | null
  created: string
  updated: string
}

interface PortalManagerProps {
  clientId: string
  initialConfig: PortalConfigState
  initialFields: SiteContentField[]
  initialRequests: ChangeRequestItem[]
}

interface ContentFormState {
  field_key: string
  field_label: string
  field_type: 'text' | 'richtext' | 'image' | 'url'
  page_section: string
  field_value: string
}

const defaultContentForm: ContentFormState = {
  field_key: '',
  field_label: '',
  field_type: 'text',
  page_section: '',
  field_value: '',
}

type VerifyStatus = 'idle' | 'verifying' | 'ok' | 'fail'

function priorityBadgeClass(priority: string) {
  if (priority === 'URGENT') return 'border-red-200 bg-red-50 text-red-700'
  if (priority === 'LOW') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

function statusBadgeClass(status: string) {
  if (status === 'COMPLETED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (status === 'IN_PROGRESS') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (status === 'REJECTED') return 'border-slate-300 bg-slate-100 text-slate-700'
  return 'border-amber-200 bg-amber-50 text-amber-700'
}

export default function PortalManager({ clientId, initialConfig, initialFields, initialRequests }: PortalManagerProps) {
  const [config, setConfig] = useState<PortalConfigState>(initialConfig)
  const [fields, setFields] = useState<SiteContentField[]>(initialFields)
  const [requests, setRequests] = useState<ChangeRequestItem[]>(initialRequests)
  const [isSavingConfig, setIsSavingConfig] = useState(false)
  const [configMessage, setConfigMessage] = useState<{ text: string; ok: boolean } | null>(null)
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()

  // Site URL verification
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>('idle')
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  const [isFieldModalOpen, setIsFieldModalOpen] = useState(false)
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null)
  const [fieldForm, setFieldForm] = useState<ContentFormState>(defaultContentForm)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [isSavingField, setIsSavingField] = useState(false)
  const [requestMessage, setRequestMessage] = useState<string | null>(null)
  const [requestSavingId, setRequestSavingId] = useState<string | null>(null)

  const requestDrafts = useMemo(() => {
    const initial: Record<string, { status: string; admin_comment: string }> = {}
    for (const req of requests) {
      initial[req.id] = { status: req.status, admin_comment: req.admin_comment ?? '' }
    }
    return initial
  }, [requests])

  const [requestEdits, setRequestEdits] = useState<Record<string, { status: string; admin_comment: string }>>(requestDrafts)

  async function verifySiteUrl() {
    const url = config.site_url.trim()
    if (!url) return
    setVerifyStatus('verifying')
    setVerifyMessage(null)
    try {
      const res = await fetch('/api/admin/verify-ngf-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const result = await res.json() as { compatible: boolean; error?: string }
      if (result.compatible) {
        setVerifyStatus('ok')
        setVerifyMessage('NGF-compatible site confirmed')
      } else {
        setVerifyStatus('fail')
        setVerifyMessage(result.error ?? 'Site verification failed')
      }
    } catch {
      setVerifyStatus('fail')
      setVerifyMessage('Could not reach verification service')
    }
  }

  async function saveConfig() {
    setConfigMessage(null)
    setIsSavingConfig(true)
    try {
      const response = await fetch(`/api/admin/portal/${clientId}/config`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      const result = await response.json() as { success: boolean; error?: string }
      if (!response.ok || !result.success) {
        setConfigMessage({ text: result.error ?? 'Failed to save portal settings', ok: false })
        return
      }
      setConfigMessage({ text: 'Portal settings saved', ok: true })
      // If site_url was just saved successfully, mark it as verified
      if (config.site_url.trim()) setVerifyStatus('ok')
    } catch {
      setConfigMessage({ text: 'Failed to save portal settings', ok: false })
    } finally {
      setIsSavingConfig(false)
    }
  }

  function openCreateFieldModal() {
    setFieldError(null)
    setEditingFieldId(null)
    setFieldForm(defaultContentForm)
    setIsFieldModalOpen(true)
  }

  function openEditFieldModal(field: SiteContentField) {
    setFieldError(null)
    setEditingFieldId(field.id)
    setFieldForm({
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type as 'text' | 'richtext' | 'image' | 'url',
      page_section: field.page_section,
      field_value: field.field_value ?? '',
    })
    setIsFieldModalOpen(true)
  }

  async function saveField() {
    setFieldError(null)
    setIsSavingField(true)
    try {
      const endpoint = editingFieldId
        ? `/api/admin/portal/${clientId}/content/${editingFieldId}`
        : `/api/admin/portal/${clientId}/content`
      const response = await fetch(endpoint, {
        method: editingFieldId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldForm),
      })
      const result = await response.json() as { success: boolean; error?: string; data?: SiteContentField }
      if (!response.ok || !result.success) {
        setFieldError(result.error ?? 'Failed to save content field')
        return
      }
      if (editingFieldId) {
        setFields((prev) =>
          prev.map((item) =>
            item.id === editingFieldId
              ? {
                  ...item,
                  ...result.data,
                  created: new Date(result.data!.created).toISOString(),
                  updated: new Date(result.data!.updated).toISOString(),
                }
              : item
          )
        )
      } else {
        setFields((prev) => [
          {
            ...result.data!,
            created: new Date(result.data!.created).toISOString(),
            updated: new Date(result.data!.updated).toISOString(),
          },
          ...prev,
        ])
      }
      setIsFieldModalOpen(false)
      setEditingFieldId(null)
      setFieldForm(defaultContentForm)
    } catch {
      setFieldError('Failed to save content field')
    } finally {
      setIsSavingField(false)
    }
  }

  async function deleteField(fieldId: string) {
    if (!await confirm('Delete this content field?')) return
    try {
      const response = await fetch(`/api/admin/portal/${clientId}/content/${fieldId}`, { method: 'DELETE' })
      const result = await response.json() as { success: boolean; error?: string }
      if (!response.ok || !result.success) {
        setFieldError(result.error ?? 'Failed to delete content field')
        return
      }
      setFields((prev) => prev.filter((item) => item.id !== fieldId))
    } catch {
      setFieldError('Failed to delete content field')
    }
  }

  async function deleteRequest(requestId: string) {
    if (!await confirm('Delete this change request? This cannot be undone.')) return
    try {
      const response = await fetch(`/api/admin/portal/${clientId}/requests/${requestId}`, { method: 'DELETE' })
      const result = await response.json() as { success: boolean; error?: string }
      if (!response.ok || !result.success) {
        setRequestMessage(result.error ?? 'Failed to delete change request')
        return
      }
      setRequests((prev) => prev.filter((item) => item.id !== requestId))
      setRequestEdits((prev) => { const next = { ...prev }; delete next[requestId]; return next })
    } catch {
      setRequestMessage('Failed to delete change request')
    }
  }

  async function saveRequest(requestId: string) {
    const draft = requestEdits[requestId]
    if (!draft) return
    setRequestMessage(null)
    setRequestSavingId(requestId)
    try {
      const response = await fetch(`/api/admin/portal/${clientId}/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const result = await response.json() as { success: boolean; error?: string; data?: ChangeRequestItem }
      if (!response.ok || !result.success) {
        setRequestMessage(result.error ?? 'Failed to update change request')
        return
      }
      setRequests((prev) =>
        prev.map((item) =>
          item.id === requestId
            ? {
                ...item,
                status: result.data!.status,
                admin_comment: result.data!.admin_comment,
                updated: new Date(result.data!.updated).toISOString(),
              }
            : item
        )
      )
      setRequestMessage('Change request updated')
    } catch {
      setRequestMessage('Failed to update change request')
    } finally {
      setRequestSavingId(null)
    }
  }

  const verifyButtonLabel =
    verifyStatus === 'verifying' ? 'Testing…' : verifyStatus === 'ok' ? '✓ NGF Site' : verifyStatus === 'fail' ? '✗ Not NGF' : 'Test Site'
  const verifyButtonClass =
    verifyStatus === 'ok'
      ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
      : verifyStatus === 'fail'
      ? 'bg-red-50 border-red-300 text-red-700'
      : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'

  return (
    <div className="space-y-6">
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Portal Settings</h2>
        <p className="mt-1 text-sm text-gray-500">Control page visibility, feature flags, and website connection settings.</p>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['page_website', 'Website Page'],
            ['page_content', 'Content Page'],
            ['page_invoices', 'Invoices Page'],
            ['page_request', 'Request Page'],
            ['feature_blog', 'Blog Feature'],
            ['feature_products', 'Products Feature'],
            ['feature_booking', 'Booking Feature'],
            ['feature_gallery', 'Gallery Feature'],
          ].map(([key, label]) => {
            const typedKey = key as keyof PortalConfigState
            return (
              <label key={key} className="flex h-11 items-center justify-between rounded-lg border border-gray-200 px-3">
                <span className="text-sm text-gray-700">{label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(config[typedKey])}
                  onChange={(event) => setConfig((prev) => ({ ...prev, [typedKey]: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </label>
            )
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Database URL</label>
            <input
              type="text"
              value={config.database_url}
              onChange={(event) => setConfig((prev) => ({ ...prev, database_url: event.target.value }))}
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="postgresql://..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Booking URL</label>
            <input
              type="text"
              value={config.booking_url}
              onChange={(event) => setConfig((prev) => ({ ...prev, booking_url: event.target.value }))}
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="https://example.com/booking/[token]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Site URL
              <span className="ml-1 text-xs font-normal text-gray-400">(NGF-managed sites only)</span>
            </label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={config.site_url}
                onChange={(event) => {
                  setConfig((prev) => ({ ...prev, site_url: event.target.value }))
                  setVerifyStatus('idle')
                  setVerifyMessage(null)
                }}
                className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                placeholder="https://client.example.com"
              />
              <button
                type="button"
                onClick={verifySiteUrl}
                disabled={!config.site_url.trim() || verifyStatus === 'verifying'}
                className={`h-11 flex-shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors disabled:opacity-40 ${verifyButtonClass}`}
              >
                {verifyButtonLabel}
              </button>
            </div>
            {verifyMessage && (
              <p className={`mt-1 text-xs ${verifyStatus === 'ok' ? 'text-emerald-600' : 'text-red-600'}`}>
                {verifyMessage}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Site Repo</label>
            <input
              type="text"
              value={config.site_repo}
              onChange={(event) => setConfig((prev) => ({ ...prev, site_repo: event.target.value }))}
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="owner/repo"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveConfig}
            disabled={isSavingConfig}
            className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isSavingConfig ? 'Saving...' : 'Save Settings'}
          </button>
          {configMessage && (
            <p className={`text-sm ${configMessage.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {configMessage.text}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Content Fields</h2>
            <p className="mt-1 text-sm text-gray-500">Define exactly which site fields this client can edit in their portal.</p>
          </div>
          <button
            type="button"
            onClick={openCreateFieldModal}
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add Field
          </button>
        </div>
        {fieldError && <p className="mt-4 text-sm text-red-600">{fieldError}</p>}
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Key</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Label</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Section</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Value</th>
                <th className="py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fields.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-gray-500">No content fields yet.</td>
                </tr>
              ) : (
                fields.map((field) => (
                  <tr key={field.id}>
                    <td className="py-3 pr-4 text-sm text-gray-900">{field.field_key}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700">{field.field_label}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700">{field.field_type}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700">{field.page_section}</td>
                    <td className="py-3 pr-4 text-sm text-gray-700">{field.field_value ?? '—'}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditFieldModal(field)}
                          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteField(field.id)}
                          className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Change Requests</h2>
        <p className="mt-1 text-sm text-gray-500">Review client-submitted requests and update status with internal notes.</p>
        {requestMessage && <p className="mt-4 text-sm text-gray-600">{requestMessage}</p>}
        <div className="mt-5 space-y-4">
          {requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No change requests yet.
            </div>
          ) : (
            requests.map((item) => {
              const images = item.image_urls
                ? item.image_urls.split(',').map((url) => url.trim()).filter((url) => url.length > 0)
                : []
              return (
                <article key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                      <p className="mt-1 text-sm text-gray-600">{item.description ?? 'No description provided.'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadgeClass(item.priority)}`}>
                        {item.priority}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Submitted {new Date(item.created).toLocaleDateString()}
                    {item.page_section ? ` • ${item.page_section}` : ''}
                  </p>
                  {images.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {images.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-gray-200 bg-white">
                          <img src={url} alt="Request upload" className="h-28 w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Status</label>
                      <select
                        value={requestEdits[item.id]?.status ?? item.status}
                        onChange={(event) =>
                          setRequestEdits((prev) => ({
                            ...prev,
                            [item.id]: { status: event.target.value, admin_comment: prev[item.id]?.admin_comment ?? item.admin_comment ?? '' },
                          }))
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="IN_PROGRESS">IN_PROGRESS</option>
                        <option value="COMPLETED">COMPLETED</option>
                        <option value="REJECTED">REJECTED</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Admin Comment</label>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="text"
                          value={requestEdits[item.id]?.admin_comment ?? item.admin_comment ?? ''}
                          onChange={(event) =>
                            setRequestEdits((prev) => ({
                              ...prev,
                              [item.id]: { status: prev[item.id]?.status ?? item.status, admin_comment: event.target.value },
                            }))
                          }
                          className="h-10 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                          placeholder="Optional note for client"
                        />
                        <button
                          type="button"
                          onClick={() => saveRequest(item.id)}
                          disabled={requestSavingId === item.id}
                          className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                        >
                          {requestSavingId === item.id ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRequest(item.id)}
                          disabled={requestSavingId === item.id}
                          className="inline-flex h-10 items-center rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </div>
      </section>

      {isFieldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-lg">
            <h3 className="font-sans text-lg font-semibold tracking-tight text-gray-900">
              {editingFieldId ? 'Edit Content Field' : 'Add Content Field'}
            </h3>
            {fieldError && <p className="mt-3 text-sm text-red-600">{fieldError}</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Field Key</label>
                <input
                  type="text"
                  value={fieldForm.field_key}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, field_key: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Field Label</label>
                <input
                  type="text"
                  value={fieldForm.field_label}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, field_label: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Field Type</label>
                <select
                  value={fieldForm.field_type}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, field_type: event.target.value as 'text' | 'richtext' | 'image' | 'url' }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="text">text</option>
                  <option value="richtext">richtext</option>
                  <option value="image">image</option>
                  <option value="url">url</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Page Section</label>
                <input
                  type="text"
                  value={fieldForm.page_section}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, page_section: event.target.value }))}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">Initial Value</label>
                <textarea
                  value={fieldForm.field_value}
                  onChange={(event) => setFieldForm((prev) => ({ ...prev, field_value: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => { setIsFieldModalOpen(false); setFieldError(null) }}
                className="h-11 flex-1 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveField}
                disabled={isSavingField}
                className="h-11 flex-1 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSavingField ? 'Saving...' : editingFieldId ? 'Save Changes' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </d