import Link from 'next/link'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const pageBadgeStyles: Record<string, string> = {
  Website: 'bg-blue-50 text-blue-700 border-blue-200',
  Content: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Invoices: 'bg-amber-50 text-amber-700 border-amber-200',
  Request: 'bg-purple-50 text-purple-700 border-purple-200',
}

export default async function AdminPortalPage() {
  const clients = await db.client.findMany({
    where: { status: 'ACTIVE' },
    include: { config: true },
    orderBy: { created: 'desc' },
  })

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Portal</h1>
        <p className="mt-1 text-sm text-gray-500">Manage portal access, content fields, and change requests by client.</p>
      </header>

      {clients.length === 0 ? (
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No active clients yet</p>
            <p className="mt-2 text-sm text-gray-500">Activate clients first, then manage their portals here.</p>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const enabledPages: string[] = []
            if (client.config?.page_website) enabledPages.push('Website')
            if (client.config?.page_content) enabledPages.push('Content')
            if (client.config?.page_invoices) enabledPages.push('Invoices')
            if (client.config?.page_request) enabledPages.push('Request')

            return (
              <article key={client.id} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">{client.name ?? 'Unnamed Client'}</h2>
                    <p className="mt-1 text-sm text-gray-500 break-words">{client.email ?? 'No email on file'}</p>
                  </div>
                  <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                    {client.status}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Enabled pages</p>
                  {enabledPages.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">No pages enabled</p>
                  ) : (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {enabledPages.map((page) => (
                        <span
                          key={page}
                          className={`rounded-full border px-2.5 py-1 text-xs font-medium ${pageBadgeStyles[page]}`}
                        >
                          {page}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-5">
                  <Link
                    href={`/admin/portal/${client.id}`}
                    className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
                  >
                    Manage Portal
                  </Link>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
