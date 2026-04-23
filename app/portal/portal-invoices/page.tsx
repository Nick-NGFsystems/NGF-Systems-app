import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import { stripe } from '@/lib/stripe'
import ManagePaymentButton from '@/components/portal/ManagePaymentButton'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function formatDate(date: Date | string | number | null | undefined): string {
  if (date === null || date === undefined) return 'N/A'
  const d = typeof date === 'number' ? new Date(date * 1000) : new Date(date)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusColor(status: string): string {
  const s = status.toUpperCase()
  if (s === 'ACTIVE' || s === 'TRIALING' || s === 'PAID')      return 'bg-emerald-100 text-emerald-800'
  if (s === 'PAST_DUE' || s === 'UNPAID' || s === 'OPEN')      return 'bg-amber-100 text-amber-800'
  if (s === 'CANCELED' || s === 'CANCELLED' || s === 'VOID')   return 'bg-gray-200 text-gray-700'
  if (s === 'DRAFT')                                           return 'bg-gray-100 text-gray-600'
  return 'bg-gray-100 text-gray-700'
}

export default async function PortalInvoicesPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client?.config?.page_invoices) redirect('/unauthorized')

  // DB-mirrored subscription (webhook-synced).
  const subscription = await db.subscription.findFirst({
    where:   { client_id: client.id, status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] } },
    orderBy: { created: 'desc' },
  })

  // Live invoices from Stripe. Tolerate failure.
  let invoices: Stripe.Invoice[] = []
  if (client.stripe_customer_id) {
    try {
      const res = await stripe.invoices.list({
        customer: client.stripe_customer_id,
        limit:    20,
      })
      invoices = res.data
    } catch (err) {
      console.error('[portal/invoices] failed to list invoices', err)
    }
  }

  const openInvoices = invoices.filter((i) => i.status === 'open')
  const pastInvoices = invoices.filter((i) => i.status !== 'open')

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Billing</h1>
          <p className="mt-1 text-sm text-gray-500">Your subscription status and invoice history.</p>
        </div>
        {client.stripe_customer_id ? (
          <ManagePaymentButton />
        ) : null}
      </header>

      {/* Current subscription */}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Current subscription</h2>
        {subscription ? (
          <>
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
                    /{subscription.plan_type === 'YEARLY' ? 'yr' : 'mo'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Status</p>
                <span className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(subscription.status)}`}>
                  {subscription.status}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {subscription.cancel_at_period_end ? 'Ends on' : 'Renews on'}
                </p>
                <p className="mt-1 font-semibold text-gray-900">{formatDate(subscription.current_period_end)}</p>
              </div>
            </div>
            {subscription.cancel_at_period_end ? (
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
                This subscription will end on {formatDate(subscription.current_period_end)}. Contact us to reinstate.
              </p>
            ) : null}
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No active subscription. If you&apos;re expecting one, please contact your account manager.
          </div>
        )}
      </section>

      {/* Open invoices */}
      {openInvoices.length > 0 ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-amber-900">
            {openInvoices.length === 1 ? 'Invoice due' : 'Invoices due'}
          </h2>
          <p className="mt-1 text-sm text-amber-800">Click to view and pay.</p>
          <ul className="mt-3 divide-y divide-amber-200">
            {openInvoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-amber-900">
                    {formatCents(inv.amount_due)}
                    <span className="ml-2 text-xs font-normal text-amber-700">{inv.number ?? inv.id}</span>
                  </p>
                  <p className="text-xs text-amber-700">
                    Created {formatDate(inv.created)}
                    {inv.due_date ? ` · Due ${formatDate(inv.due_date)}` : ''}
                  </p>
                </div>
                {inv.hosted_invoice_url ? (
                  <a
                    href={inv.hosted_invoice_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-amber-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-800"
                  >
                    View & pay →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Past invoices */}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Invoice history</h2>
        {pastInvoices.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
            No invoices yet.
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {pastInvoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {formatCents(inv.amount_paid || inv.amount_due)}
                    <span className="ml-2 text-xs font-normal text-gray-500">{inv.number ?? inv.id}</span>
                  </p>
                  <p className="text-xs text-gray-500">{formatDate(inv.created)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(inv.status ?? 'unknown')}`}>
                    {(inv.status ?? 'unknown').toUpperCase()}
                  </span>
                  {inv.hosted_invoice_url ? (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  )
}
