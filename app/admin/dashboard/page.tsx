import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface StatCard {
  label: string
  value: string
}

interface QuickAction {
  label: string
  href: string
}

const quickActions: QuickAction[] = [
  { label: 'Add Client', href: '/admin/clients' },
  { label: 'New Project', href: '/admin/projects' },
  { label: 'New Invoice', href: '/admin/finances' },
]

function getGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}

export default async function DashboardPage() {
  const now = new Date()

  const [user, totalClients, activeProjects, recurringIncomeResult] = await Promise.all([
    currentUser(),
    db.client.count({
      where: {
        status: 'ACTIVE',
      },
    }),
    db.project.count({
      where: {
        status: {
          in: ['ACTIVE', 'IN_PROGRESS'],
        },
      },
    }),
    db.recurringIncome.findMany(),
  ])

  // Calculate monthly revenue from recurring income
  const monthlyRevenue = recurringIncomeResult.reduce((sum, item) => {
    return sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount)
  }, 0)

  const firstName = user?.firstName ?? 'Nick'
  const greeting = getGreeting()

  const statCards: StatCard[] = [
    { label: 'Total Clients', value: totalClients.toString() },
    { label: 'Active Projects', value: activeProjects.toString() },
    {
      label: 'Monthly Revenue',
      value: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(monthlyRevenue),
    },
  ]

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          {greeting}, {firstName}
        </h1>
        <p className="text-sm text-gray-500">Here is your business snapshot for today.</p>
      </header>

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
        <div className="flex items-center justify-between">
          <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">
            Quick Actions
          </h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
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

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-lg font-semibold tracking-tight text-gray-900">
          Recent Activity
        </h2>
        <div className="mt-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <p className="text-sm text-gray-500">No recent activity yet. New updates will appear here.</p>
        </div>
      </section>
    </section>
  )
}
