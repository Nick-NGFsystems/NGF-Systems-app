import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import PortalContentEditor from '@/components/portal/PortalContentEditor'

export const dynamic = 'force-dynamic'

export default async function PortalContentPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client?.config?.page_content) redirect('/unauthorized')

  if (!client.config?.database_url) {
    return (
      <section className="space-y-8">
        <header>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Content</h1>
        </header>

        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">Website database not connected</p>
            <p className="mt-2 text-sm text-gray-500">Your website database has not been connected yet. Contact your administrator.</p>
          </div>
        </section>
      </section>
    )
  }

  const fields = await db.siteContent.findMany({
    where: { client_id: client.id },
    orderBy: { created: 'desc' },
  })

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Content</h1>
        <p className="mt-1 text-sm text-gray-500">Update your website content fields below.</p>
      </header>

      {fields.length === 0 ? (
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No editable content yet</p>
            <p className="mt-2 text-sm text-gray-500">Your administrator has not added content fields for your site yet.</p>
          </div>
        </section>
      ) : (
        <PortalContentEditor
          initialFields={fields.map((field) => ({
            id: field.id,
            field_key: field.field_key,
            field_type: field.field_type,
            field_label: field.field_label,
            field_value: field.field_value,
            page_section: field.page_section,
          }))}
        />
      )}
    </section>
  )
}
