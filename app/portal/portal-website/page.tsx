import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import ChangeRequestForm from '@/components/portal/ChangeRequestForm'

export const dynamic = 'force-dynamic'

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

export default async function PortalWebsitePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const client = await getClientConfig(userId)
  if (!client?.config?.page_website) redirect('/unauthorized')
  const requests = await db.changeRequest.findMany({
    where: { client_id: client.id },
    orderBy: { created: 'desc' },
  })
  const openCount = requests.filter(r => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length
  const completedCount = requests.filter(r => r.status === 'COMPLETED').length
  return (
    <section className="space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">My Website</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your website and submit change requests.</p>
        </div>
        <ChangeRequestForm />
      </header>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Website Details</h2>
          {client.config?.site_url && (
            <Link href="/portal/website" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition">
              Open Editor &#x2192;
            </Link>
          )}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Site URL</p>
            {client.config?.site_url ? (
              <Link href={client.config.site_url} target="_blank" className="mt-1 inline-block text-sm font-medium text-blue-600 underline-offset-2 hover:underline">{client.config.site_url}</Link>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Not set yet</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Site Repo</p>
            <p className="mt-1 text-sm text-gray-700 break-words">{client.config?.site_repo || 'Not set yet'}</p>
          </div>
        </div>
        {requests.length > 0 && (
          <div className="mt-5 flex gap-6 border-t border-gray-100 pt-4">
            <div><p className="text-2xl font-semibold text-slate-900">{openCount}</p><p className="text-xs text-gray-500">Open requests</p></div>
            <div><p className="text-2xl font-semibold text-slate-900">{completedCount}</p><p className="text-xs text-gray-500">Completed</p></div>
          </div>
        )}
      </section>
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Change Requests</h2>
          {openCount > 0 && <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">{openCount} open</span>}
        </div>
        <div className="space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">No requests yet</p>
              <p className="text-xs text-gray-400">Use the button above to submit your first change request.</p>
            </div>
          ) : requests.map((item) => (
            <article key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                  {item.description && <p className="mt-1 text-sm text-gray-600">{item.description}</p>}
                  {item.page_section && <p className="mt-1 text-xs text-gray-400">Page: {item.page_section}</p>}
                  {item.image_urls && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.image_urls.split(',').filter(Boolean).map((url, i) => (
                        <a key={i} href={url.trim()} target="_blank" rel="noopener noreferrer">
                          <img src={url.trim()} alt={`Request image ${i + 1}`} className="h-16 w-16 rounded-lg object-cover border border-gray-200 hover:opacity-80 transition" />
                        </a>
                      ))}
                    </div>
                  )}
                  {item.admin_comment && (
                    <div className="mt-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <p className="text-xs font-medium text-blue-700 mb-0.5">NGF response:</p>
                      <p className="text-xs text-blue-800">{item.admin_comment}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityBadgeClass(item.priority)}`}>{item.priority}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(item.status)}`}>{item.status.replace('_', ' ')}</span>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">{new Date(item.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  )
}
