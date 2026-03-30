import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

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

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">My Website</h1>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Website Details</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Site URL</p>
            {client.config?.site_url ? (
              <Link href={client.config.site_url} target="_blank" className="mt-1 inline-block text-sm font-medium text-blue-600 underline-offset-2 hover:underline">
                {client.config.site_url}
              </Link>
            ) : (
              <p className="mt-1 text-sm text-gray-500">Not set yet</p>
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Site Repo</p>
            <p className="mt-1 text-sm text-gray-700 break-words">{client.config?.site_repo || 'Not set yet'}</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Change Requests</h2>
        <div className="mt-4 space-y-3">
          {requests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No requests submitted yet.
            </div>
          ) : (
            requests.map((item) => (
              <article key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-sm text-gray-600">{item.description || 'No description provided.'}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass(item.status)}`}>
                    {item.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-gray-500">{new Date(item.created).toLocaleDateString()}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  )
}
