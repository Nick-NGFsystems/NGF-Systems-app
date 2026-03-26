import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'

export const dynamic = 'force-dynamic'

interface EmptyState {
  title: string
  description: string
}

const emptyState: EmptyState = {
  title: 'No editable content yet',
  description: 'When content fields are enabled, you will be able to update text and media here.',
}

export default async function PortalContentPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const client = await getClientConfig(userId!)
  if (!client?.config?.page_content) redirect('/unauthorized')
  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Content</h1>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">{emptyState.title}</p>
          <p className="mt-2 text-sm text-gray-500">{emptyState.description}</p>
        </div>
      </section>
    </section>
  )
}
