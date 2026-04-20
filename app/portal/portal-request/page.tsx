import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import PortalRequestForm from '@/components/portal/PortalRequestForm'

export const dynamic = 'force-dynamic'

export default async function PortalRequestPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client?.config?.page_request) redirect('/unauthorized')

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Request Changes</h1>
        <p className="mt-1 text-sm text-gray-500">Submit website updates, fixes, or feature requests for review.</p>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <PortalRequestForm />
      </section>
    </section>
  )
}
