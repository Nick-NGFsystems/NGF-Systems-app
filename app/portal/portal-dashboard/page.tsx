import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface QuickAction {
  label: string
  href: string
}

const quickActions: QuickAction[] = [
  { label: 'Request a Change', href: '/portal/portal-request' },
  { label: 'View Invoices', href: '/portal/portal-invoices' },
  { label: 'My Website', href: '/portal/portal-website' },
]

export default async function PortalDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client?.config) redirect('/unauthorized')

  // Fetch real stats in parallel
  const [activeProjects, openRequests, subscription] = await Promise.all([
    db.project.count({
      where: { client_id: client.id, status: { not: 'COMPLETED' } },
    }),
    db.projectRequest.count({
      where: { client_id: client.id },
    }),
    db.subscription.findUnique({
      where: { client_id: client.id },
    }),
  ])

  const nextInvoiceDate = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      })
    : 'N/A'

  const statCards = [
    { label: 'Active Projects', value: String(activeProjects) },
    { label: 'Open Requests', value: String(openRequests) },
    { label: 'Next Invoice Due', value: nextInvoiceDate },
  ]

  return (
    <section className="space-y-10">
      <section>
        <header className="space-y-2">
          <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl xl">
            Welcome back
          </h1>
          <p className="text-sm text-gray-500">
            Here&apos;s an overview of your account.
          </p>
        </header>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-slate-900">
              {card.value}
            </p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">Quick Actions</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-600 hover:text-blue-600"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-gray-900">{action.label}</span>
                <span className="text-blue-600" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
