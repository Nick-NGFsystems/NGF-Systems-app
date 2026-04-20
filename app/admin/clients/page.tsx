import AddClientModal from '@/components/admin/AddClientModal'
import ClientsTable from '@/components/admin/ClientsTable'
import { db } from '@/lib/db'
import { formatLastLogin, getClientLastLoginMap } from '@/lib/client-last-login'

export const dynamic = 'force-dynamic'

const emptyState = {
  title: 'No clients yet',
  description: 'Create a client to start managing their portal access and configuration.',
}

export default async function ClientsPage() {
  const clients = await db.client.findMany({
    include: { config: true },
    orderBy: {
      created: 'desc',
    },
  })

  const lastLoginMap = await getClientLastLoginMap(
    clients.map((client) => client.clerk_user_id).filter((id): id is string => Boolean(id))
  )

  const clientRows = clients.map((client) => ({
    id: client.id,
    name: client.name,
    email: client.email,
    phone: client.phone,
    contact_names: client.contact_names,
    notes: client.notes,
    status: client.status,
    createdLabel: new Date(client.created).toLocaleDateString(),
    lastLoginLabel: formatLastLogin(client.clerk_user_id ? lastLoginMap[client.clerk_user_id] : null),
    portalPages: [
      client.config?.page_request ? 'Request' : null,
      client.config?.page_website ? 'Website' : null,
      client.config?.page_content ? 'Content' : null,
      client.config?.page_invoices ? 'Invoices' : null,
    ].filter((value): value is string => Boolean(value)),
  }))

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Clients</h1>
          <p className="mt-1 text-sm text-gray-500">Manage client records, portal access, and enabled pages in one place.</p>
        </div>
        <AddClientModal />
      </header>

      {clientRows.length === 0 ? (
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="m-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">{emptyState.title}</p>
            <p className="mt-2 text-sm text-gray-500">{emptyState.description}</p>
          </div>
        </section>
      ) : (
        <ClientsTable clients={clientRows} />
      )}
    </section>
  )
}
