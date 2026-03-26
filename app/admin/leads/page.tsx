import { db } from '@/lib/db'
import Link from 'next/link'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const leads = await db.client.findMany({
    where: { status: 'LEAD' },
    orderBy: { created: 'desc' },
  })

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Clients who signed up through the website. Review and convert them to active clients.
        </p>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {leads.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No leads yet</p>
            <p className="mt-2 text-sm text-gray-500">New sign-ups from the website will appear here.</p>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-gray-100 px-6 py-4 md:grid md:grid-cols-4 md:gap-4">
              {['Name', 'Email', 'Signed Up', 'Actions'].map((col) => (
                <p key={col} className="text-xs font-semibold uppercase tracking-wide text-gray-500">{col}</p>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <div key={lead.id} className="grid grid-cols-1 gap-2 px-6 py-4 md:grid-cols-4 md:gap-4 md:items-center">
                  <p className="text-sm font-medium text-gray-900">{lead.name}</p>
                  <p className="text-sm text-gray-600">{lead.email}</p>
                  <p className="text-sm text-gray-600">{new Date(lead.created).toLocaleDateString()}</p>
                  <Link
                    href={`/admin/clients/${lead.id}`}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 w-fit"
                  >
                    View &amp; Manage →
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
