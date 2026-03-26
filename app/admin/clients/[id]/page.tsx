import { db } from '@/lib/db'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'
import EditClientModal from '@/components/admin/EditClientModal'
import ConfigToggles from '@/components/admin/ConfigToggles'

interface ClientDetailPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function ClientDetailPage({ params }: ClientDetailPageProps) {
  const resolvedParams = await params

  const client = await db.client.findUnique({
    where: { id: resolvedParams.id },
    include: { config: true },
  })

  if (!client) {
    notFound()
  }

  return (
    <section className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/clients"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <span aria-hidden="true">←</span> Back to Clients
      </Link>

      {/* Client info card */}
      <header className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <h1 className="font-sans text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            {client.name}
          </h1>
          <EditClientModal
            clientId={client.id}
            currentName={client.name}
            currentEmail={client.email}
          />
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Email</p>
            <p className="mt-1 text-sm text-gray-900">{client.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Created</p>
            <p className="mt-1 text-sm text-gray-900">{new Date(client.created).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</p>
            <div className="mt-1">
              <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
            </div>
          </div>
        </div>
      </header>

      {/* Portal configuration card */}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">
          Portal Configuration
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Toggle which pages and features are visible in this client&apos;s portal.
        </p>

        <div className="mt-5">
          {!client.config ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
              <p className="text-sm text-gray-500">No config record found for this client.</p>
            </div>
          ) : (
            <ConfigToggles
              configId={client.config.id}
              initialValues={{
                page_request: client.config.page_request,
                page_website: client.config.page_website,
                page_content: client.config.page_content,
                page_invoices: client.config.page_invoices,
                feature_blog: client.config.feature_blog,
                feature_products: client.config.feature_products,
                feature_booking: client.config.feature_booking,
                feature_gallery: client.config.feature_gallery,
              }}
            />
          )}
        </div>
      </section>
    </section>
  )
}

