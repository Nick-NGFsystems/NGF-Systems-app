import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'

export const dynamic = 'force-dynamic'

interface ClientDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const resolvedParams = await params

  const client = await db.client.findUnique({
    where: { id: resolvedParams.id },
  })

  if (!client) {
    notFound()
  }

  return (
    <section className="space-y-6">
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <span aria-hidden="true">←</span> Back to Clients
      </Link>

      <header className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {client.name ?? 'Unnamed Client'}
          </h1>
          <Link
            href={`/admin/portal/${client.id}`}
            className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Manage Portal →
          </Link>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
            <p className="mt-1 text-sm text-gray-900 break-words">{client.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</p>
            <div className="mt-1">
              <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Created</p>
            <p className="mt-1 text-sm text-gray-900">{new Date(client.created).toLocaleDateString()}</p>
          </div>
        </div>
      </header>
    </section>
  )
}

