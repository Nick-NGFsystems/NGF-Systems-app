import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { getClientDb } from '@/lib/client-db'
import ServiceRequestsManager from '@/components/admin/ServiceRequestsManager'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function ServiceRequestsPage({
  params,
}: {
  params: Promise<{ clientId: string }>
}) {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role
  if (role !== 'admin') redirect('/unauthorized')

  const { clientId } = await params

  const client = await db.client.findUnique({
    where: { id: clientId },
    include: { config: true },
  })

  if (!client) redirect('/admin/portal')

  let requests: any[] = []
  let dbError: string | null = null

  if (client.config?.database_url) {
    try {
      const clientDb = getClientDb(client.config.database_url)
      requests = await (clientDb as any).serviceRequest.findMany({
        orderBy: { createdAt: 'desc' },
      })
    } catch (err) {
      dbError = 'Could not connect to client database. Check the database URL in portal settings.'
    }
  } else {
    dbError = 'No database URL configured for this client. Add it in portal settings.'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/portal/${clientId}`}
          className="text-sm text-gray-500 hover:text-blue-600 transition"
        >
          ← Back to Portal Settings
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Service Requests
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {client.name} — inbound booking requests from their website
        </p>
      </div>

      {dbError ? (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6">
          <p className="text-sm text-red-600">{dbError}</p>
        </div>
      ) : (
        <ServiceRequestsManager
          requests={requests}
          clientId={clientId}
          bookingUrl={client.config?.booking_url ?? null}
        />
      )}
    </div>
  )
}
