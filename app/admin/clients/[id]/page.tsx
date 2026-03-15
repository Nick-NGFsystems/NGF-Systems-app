import { db } from '@/lib/db'
import { notFound } from 'next/navigation'

interface ClientDetailPageProps {
  params: Promise<{
    id: string
  }>
}

interface ToggleItem {
  label: string
  enabled: boolean
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

  const toggles: ToggleItem[] = client.config
    ? [
        { label: 'Page: Request', enabled: client.config.page_request },
        { label: 'Page: Website', enabled: client.config.page_website },
        { label: 'Page: Content', enabled: client.config.page_content },
        { label: 'Page: Invoices', enabled: client.config.page_invoices },
        { label: 'Feature: Blog', enabled: client.config.feature_blog },
        { label: 'Feature: Products', enabled: client.config.feature_products },
        { label: 'Feature: Booking', enabled: client.config.feature_booking },
        { label: 'Feature: Gallery', enabled: client.config.feature_gallery },
      ]
    : []

  return (
    <section className="space-y-8">
      <header className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">{client.name}</h1>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Email:</span> {client.email}
          </p>
          <p className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">Created:</span>{' '}
            {new Date(client.created).toLocaleDateString()}
          </p>
          <p className="text-sm text-gray-600 sm:col-span-2">
            <span className="font-medium text-gray-900">Status:</span>{' '}
            <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              {client.status}
            </span>
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">
          Client Configuration (Read Only)
        </h2>

        {!client.config ? (
          <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
            <p className="text-sm text-gray-500">No config record found for this client.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {toggles.map((toggle) => (
              <div key={toggle.label} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-medium text-gray-900">{toggle.label}</p>
                <p className={`mt-2 text-sm ${toggle.enabled ? 'text-blue-600' : 'text-gray-500'}`}>
                  {toggle.enabled ? 'Enabled' : 'Disabled'}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
