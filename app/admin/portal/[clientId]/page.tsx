import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import PortalManager from '@/components/admin/PortalManager'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    clientId: string
  }>
}

export default async function AdminPortalClientPage({ params }: PageProps) {
  const { clientId } = await params

  const client = await db.client.findUnique({
    where: { id: clientId },
    include: { config: true },
  })

  if (!client) {
    notFound()
  }

  const [siteContent, changeRequests] = await Promise.all([
    db.siteContent.findMany({
      where: { client_id: clientId },
      orderBy: { created: 'desc' },
    }),
    db.changeRequest.findMany({
      where: { client_id: clientId },
      orderBy: { created: 'desc' },
    }),
  ])

  return (
    <section className="space-y-6">
      <Link
        href="/admin/portal"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition hover:text-gray-700"
      >
        <span aria-hidden="true">←</span> Back to Portal
      </Link>

      <header className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {client.name ?? 'Unnamed Client'} Portal Management
        </h1>
        <p className="mt-1 text-sm text-gray-500 break-words">{client.email ?? 'No email on file'}</p>
      </header>

      <PortalManager
        clientId={client.id}
        initialConfig={{
          page_request: client.config?.page_request ?? true,
          page_website: client.config?.page_website ?? false,
          page_content: client.config?.page_content ?? false,
          page_invoices: client.config?.page_invoices ?? false,
          feature_blog: client.config?.feature_blog ?? false,
          feature_products: client.config?.feature_products ?? false,
          feature_booking: client.config?.feature_booking ?? false,
          feature_gallery: client.config?.feature_gallery ?? false,
          database_url: client.config?.database_url ?? '',
          site_url: client.config?.site_url ?? '',
          site_repo: client.config?.site_repo ?? '',
        }}
        initialFields={siteContent.map((field) => ({
          id: field.id,
          field_key: field.field_key,
          field_label: field.field_label,
          field_type: field.field_type,
          page_section: field.page_section,
          field_value: field.field_value,
          created: field.created.toISOString(),
          updated: field.updated.toISOString(),
        }))}
        initialRequests={changeRequests.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          page_section: item.page_section,
          priority: item.priority,
          status: item.status,
          image_urls: item.image_urls,
          admin_comment: item.admin_comment,
          created: item.created.toISOString(),
          updated: item.updated.toISOString(),
        }))}
      />
    </section>
  )
}
