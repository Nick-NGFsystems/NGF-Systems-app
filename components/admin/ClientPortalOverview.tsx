'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import CreateClerkAccountButton from '@/components/admin/CreateClerkAccountButton'

interface ClientPortalOverviewProps {
  clientId: string
  clientEmail?: string | null
  clerkUserId?: string | null
  configId: string
  initialDatabaseUrl?: string | null
  initialSiteUrl?: string | null
  initialSiteRepo?: string | null
  initialTemplateId?: string | null
}

interface ApiResponse {
  success: boolean
  error?: string
}

export default function ClientPortalOverview({
  clientId,
  clientEmail,
  clerkUserId,
  configId,
  initialDatabaseUrl,
  initialSiteUrl,
  initialSiteRepo,
  initialTemplateId,
}: ClientPortalOverviewProps) {
  const router = useRouter()
  const [databaseUrl, setDatabaseUrl] = useState(initialDatabaseUrl ?? '')
  const [siteUrl, setSiteUrl] = useState(initialSiteUrl ?? '')
  const [siteRepo, setSiteRepo] = useState(initialSiteRepo ?? '')
  const [templateId, setTemplateId] = useState(initialTemplateId ?? 'generic')
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const handleSave = async () => {
    setIsSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/client-configs/${configId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          database_url: databaseUrl,
          site_url: siteUrl,
          site_repo: siteRepo,
          template_id: templateId,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setMessage(result.error ?? 'Failed to save website settings')
        return
      }

      setMessage('Website settings saved')
      router.refresh()
    } catch {
      setMessage('Failed to save website settings')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Portal Account</h2>
            <p className="mt-1 text-sm text-gray-500">Check whether this client can sign in and access their portal.</p>
          </div>
          <span
            className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
              clerkUserId
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-amber-200 bg-amber-50 text-amber-700'
            }`}
          >
            {clerkUserId ? 'Clerk account linked' : 'No Clerk account'}
          </span>
        </div>

        {clerkUserId ? (
          <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-medium text-emerald-800">This client already has a portal login.</p>
            <p className="mt-1 text-xs text-emerald-700 break-all">Clerk user ID: {clerkUserId}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/sign-in"
                className="inline-flex h-10 items-center rounded-lg border border-emerald-200 bg-white px-4 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100"
              >
                Portal Login →
              </Link>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              No Clerk account is linked yet. Create one to allow this client to log in to the portal.
            </p>
            <CreateClerkAccountButton clientId={clientId} clientEmail={clientEmail} />
          </div>
        )}
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Website Connections</h2>
        <p className="mt-1 text-sm text-gray-500">Save the database, website, and repository links for this client.</p>

        <div className="mt-5 grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Database URL</label>
            <input
              type="text"
              value={databaseUrl}
              onChange={(event) => setDatabaseUrl(event.target.value)}
              placeholder="postgresql://..."
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Site URL</label>
            <input
              type="url"
              value={siteUrl}
              onChange={(event) => setSiteUrl(event.target.value)}
              placeholder="https://example.com"
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Site Repo</label>
            <input
              type="text"
              value={siteRepo}
              onChange={(event) => setSiteRepo(event.target.value)}
              placeholder="owner/repo"
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Website Template</label>
            <select
              value={templateId}
              onChange={(event) => setTemplateId(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="generic">Generic (default)</option>
              <option value="wrenchtime">WrenchTime Cycles</option>
            </select>
            <p className="mt-1 text-xs text-gray-400">Controls which section schema the portal website editor uses.</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            {isSaving ? 'Saving...' : 'Save Links'}
          </button>
          {message && <p className="text-sm text-gray-600">{message}</p>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Quick Actions</h2>
        <p className="mt-1 text-sm text-gray-500">Jump directly into this client’s portal management tools.</p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href={`/admin/portal/${clientId}`}
            className="inline-flex h-11 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            View Portal
          </Link>
          <Link
            href={`/admin/portal/${clientId}/service-requests`}
            className="inline-flex h-11 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
          >
            View Service Requests
          </Link>
          {siteUrl ? (
            <a
              href={siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              Open Website
            </a>
          ) : null}
        </div>
      </section>
    </div>
  )
}
