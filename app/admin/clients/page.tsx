import AddClientModal from '@/components/admin/AddClientModal'
import DeleteClientButton from '@/components/admin/DeleteClientButton'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'
import { db } from '@/lib/db'
import { formatLastLogin, getClientLastLoginMap } from '@/lib/client-last-login'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface ClientColumn {
  label: string
}

interface EmptyState {
  title: string
  description: string
}

const clientColumns: ClientColumn[] = [
  { label: 'Name' },
  { label: 'Email' },
  { label: 'Phone' },
  { label: 'Names of People' },
  { label: 'Notes' },
  { label: 'Status' },
  { label: 'Last Logged In' },
  { label: 'Date Created' },
  { label: 'Actions' },
]

const emptyState: EmptyState = {
  title: 'No active clients yet',
  description: 'Create a client or convert a lead to active to see them here.',
}

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    where: { status: 'ACTIVE' },
    orderBy: {
      created: 'desc',
    },
  })

  const lastLoginMap = await getClientLastLoginMap(
    clients.map((client) => client.clerk_user_id).filter((id): id is string => Boolean(id))
  )

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Clients</h1>
        <AddClientModal />
      </header>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        {clients.length === 0 ? (
          <div className="m-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">{emptyState.title}</p>
            <p className="mt-2 text-sm text-gray-500">{emptyState.description}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {clients.map((client) => (
                <details key={client.id} className="px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{client.name ?? 'Unnamed'}</p>
                      <p className="truncate text-xs text-gray-500">{client.email ?? 'No email'}</p>
                    </div>
                    <span className="shrink-0 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600">
                      Open
                    </span>
                  </summary>

                  <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
                      <p className="mt-1 text-sm text-gray-700 break-words">{client.phone ?? '—'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Names of People</p>
                      <p className="mt-1 text-sm text-gray-700 break-words">{client.contact_names ?? '—'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notes</p>
                      <p className="mt-1 text-sm text-gray-700 break-words">{client.notes ?? '—'}</p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date Created</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {new Date(client.created).toLocaleDateString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Logged In</p>
                      <p className="mt-1 text-sm text-gray-600">
                        {formatLastLogin(client.clerk_user_id ? lastLoginMap[client.clerk_user_id] : null)}
                      </p>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                      <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
                    </div>

                    <div className="pt-1">
                      <DeleteClientButton clientId={client.id} clientName={client.name ?? 'this client'} />
                    </div>
                  </div>
                </details>
              ))}
            </div>

            <div className="hidden md:block">
              <div className="border-b border-gray-100 px-6 py-4 md:grid md:grid-cols-9 md:gap-4">
                {clientColumns.map((column) => (
                  <p key={column.label} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {column.label}
                  </p>
                ))}
              </div>

              <div className="divide-y divide-gray-100">
              {clients.map((client) => (
                <div key={client.id} className="grid grid-cols-1 gap-3 px-6 py-4 md:grid-cols-9 md:gap-4 md:items-center">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Name</p>
                    <p className="text-sm font-medium">
                      <Link
                        href={`/admin/clients/${client.id}`}
                        className="text-gray-900 transition hover:text-blue-600"
                      >
                        {client.name ?? 'Unnamed'}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Email</p>
                    <p className="text-sm text-gray-700 break-words">{client.email ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Phone</p>
                    <p className="text-sm text-gray-700 break-words">{client.phone ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Names of People</p>
                    <p className="text-sm text-gray-700 break-words">{client.contact_names ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Notes</p>
                    <p className="text-sm text-gray-700 break-words">{client.notes ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Status</p>
                    <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Last Logged In</p>
                    <p className="text-sm text-gray-600">
                      {formatLastLogin(client.clerk_user_id ? lastLoginMap[client.clerk_user_id] : null)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Date Created</p>
                    <p className="text-sm text-gray-600">
                      {new Date(client.created).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 md:hidden">Actions</p>
                    <DeleteClientButton clientId={client.id} clientName={client.name ?? 'this client'} />
                  </div>
                </div>
              ))}
              </div>
            </div>
          </>
        )}
      </section>
    </section>
  )
}
