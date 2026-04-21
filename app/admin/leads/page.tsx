import { db } from '@/lib/db'
import { formatLastLogin, getClientLastLoginMap } from '@/lib/client-last-login'
import ConvertLeadButton from '@/components/admin/ConvertLeadButton'
import DeleteClientButton from '@/components/admin/DeleteClientButton'
import AddClientModal from '@/components/admin/AddClientModal'
import EditClientModal from '@/components/admin/EditClientModal'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
  const leads = await db.client.findMany({
    where: { status: 'LEAD' },
    orderBy: { created: 'desc' },
  })

  const lastLoginMap = await getClientLastLoginMap(
    leads.map((lead) => lead.clerk_user_id).filter((id): id is string => Boolean(id))
  )

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Leads</h1>
          <p className="mt-1 text-sm text-gray-500">
          Inbound contact-form leads from ngfsystems.com. Convert qualified leads to active clients.
          </p>
        </div>
        <AddClientModal defaultStatus="LEAD" buttonLabel="Add Lead" modalTitle="Add Lead" />
      </header>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {leads.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No leads yet</p>
            <p className="mt-2 text-sm text-gray-500">New contact-form submissions will appear here automatically.</p>
          </div>
        ) : (
          <>
            <div className="hidden border-b border-gray-100 px-6 py-4 md:grid md:grid-cols-12 md:gap-4">
              {['Name', 'Email', 'Phone', 'Names of People', 'Notes', 'Business', 'Intent', 'Last Logged In', 'Date Received', 'Actions'].map((col, index) => (
                <p
                  key={col}
                  className={`text-xs font-semibold uppercase tracking-wide text-gray-500 ${index === 9 ? 'md:col-span-3' : ''}`}
                >
                  {col}
                </p>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {leads.map((lead) => (
                <div key={lead.id} className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-12 md:gap-4 md:items-start">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Name</p>
                    <p className="text-sm font-medium text-gray-900">{lead.name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Email</p>
                    <p className="text-sm text-gray-600 break-words">{lead.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Phone</p>
                    <p className="text-sm text-gray-600 break-words">{lead.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Names of People</p>
                    <p className="text-sm text-gray-600 break-words">{lead.contact_names ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Notes</p>
                    <p className="text-sm text-gray-600 break-words">{lead.notes ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Business</p>
                    <p className="text-sm text-gray-600 break-words">{lead.business ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Intent</p>
                    <p className="text-sm text-gray-600 break-words">{lead.intent ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Last Logged In</p>
                    <p className="text-sm text-gray-600">
                      {formatLastLogin(lead.clerk_user_id ? lastLoginMap[lead.clerk_user_id] : null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Date Received</p>
                    <p className="text-sm text-gray-600">{new Date(lead.created).toLocaleDateString()}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-start gap-2 md:col-span-3">
                    <EditClientModal
                      clientId={lead.id}
                      currentName={lead.name}
                      currentEmail={lead.email}
                      currentPhone={lead.phone}
                      currentContactNames={lead.contact_names}
                      currentNotes={lead.notes}
                    />
                    <ConvertLeadButton clientId={lead.id} />
                    <DeleteClientButton clientId={lead.id} clientName={lead.name ?? 'this lead'} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
