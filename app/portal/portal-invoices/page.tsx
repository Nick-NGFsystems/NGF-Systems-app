import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function PortalInvoicesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client?.config?.page_invoices) redirect('/unauthorized')

  const [subscription, contracts] = await Promise.all([
    db.subscription.findUnique({ where: { client_id: client.id } }),
    db.contract.findMany({
      where: { client_id: client.id },
      orderBy: { created: 'desc' },
    }),
  ])

  const statusColor = (status: string) => {
    switch (status.toUpperCase()) {
      case 'ACTIVE': return 'bg-green-100 text-green-800'
      case 'CANCELED': return 'bg-red-100 text-red-800'
      case 'PAST_DUE': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-gray-100 text-gray-700'
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Billing</h1>
        <p className="mt-1 text-sm text-gray-500">Your current plan and agreement history.</p>
      </header>

      {subscription ? (
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Current Plan</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Plan</p>
              <p className="mt-1 font-semibold text-gray-900">{subscription.plan_name}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Amount</p>
              <p className="mt-1 font-semibold text-gray-900">
                {formatCents(subscription.amount_cents)}
                <span className="ml-1 text-xs font-normal text-gray-500">
                  /{subscription.plan_type === 'MONTHLY' ? 'mo' : 'yr'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(subscription.status)}`}>
                {subscription.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Next Billing Date</p>
              <p className="mt-1 font-semibold text-gray-900">{formatDate(subscription.current_period_end)}</p>
            </div>
          </div>
          {subscription.cancel_at_period_end && (
            <p className="mt-4 rounded-lg bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
              Your subscription cancels at period end ({formatDate(subscription.current_period_end)}).
            </p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Current Plan</h2>
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No active subscription found. Contact your administrator.
          </div>
        </section>
      )}

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Agreements</h2>
        <div className="mt-4 space-y-3">
          {contracts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              No agreements on file yet.
            </div>
          ) : (
            contracts.map((c) => (
              <article key={c.id} className="rounded-lg border border-gray-100 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-gray-900">{c.title}</h3>
                    {c.notes && <p className="mt-1 text-sm text-gray-500">{c.notes}</p>}
                  </div>
                  <p className="shrink-0 text-xs text-gray-400">{formatDate(c.created)}</p>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Invoices</h2>
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
          <p className="text-sm font-medium text-gray-600">No invoices available</p>
          <p className="mt-1 text-sm text-gray-400">Invoices shared by your admin team will appear here.</p>
        </div>
      </section>
    </section>
  )
}
