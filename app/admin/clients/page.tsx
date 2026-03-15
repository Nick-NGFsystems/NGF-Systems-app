import AddClientModal from '@/components/admin/AddClientModal'
import DeleteClientButton from '@/components/admin/DeleteClientButton'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'
import { db } from '@/lib/db'
import Link from 'next/link'

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
  { label: 'Status' },
  { label: 'Date Created' },
  { label: 'Actions' },
]

const emptyState: EmptyState = {
  title: 'No clients yet',
  description: 'Create your first client to start tracking projects, finances, and portal access.',
}

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    orderBy: {
      created: 'desc',
    },
  })

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
            <div className="hidden border-b border-gray-100 px-6 py-4 md:grid md:grid-cols-5 md:gap-4">
              {clientColumns.map((column) => (
                <p key={column.label} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {column.label}
                </p>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {clients.map((client) => (
                <div key={client.id} className="grid grid-cols-1 gap-2 px-6 py-4 md:grid-cols-5 md:gap-4">
                  <p className="text-sm font-medium">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-gray-900 transition hover:text-blue-600"
                    >
                      {client.name}
                    </Link>
                  </p>
                  <p className="text-sm text-gray-700">{client.email}</p>
                  <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
                  <p className="text-sm text-gray-600">
                    {new Date(client.created).toLocaleDateString()}
                  </p>
                  <DeleteClientButton clientId={client.id} clientName={client.name} />
                </div>
              ))}
            </div>
          </>
        )}
      </section>
    </section>
  )
}
