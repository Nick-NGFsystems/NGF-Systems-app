import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

const quickActions = [
  { label: 'Add Client', href: '/admin/clients', description: 'Onboard a new client' },
  { label: 'New Project', href: '/admin/projects', description: 'Start a project' },
  { label: 'New Invoice', href: '/admin/finances', description: 'Create an invoice' },
  { label: 'Log Time', href: '/admin/time', description: 'Track billable hours' },
]

function getGreeting(): string {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export default async function DashboardPage() {
  const [user, totalClients, activeProjects, recurringIncomeResult, recentClients, recentRequests, pendingRequests] = await Promise.all([
    currentUser(),
    db.client.count({ where: { status: 'ACTIVE' } }),
    db.project.count({ where: { status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    db.recurringIncome.findMany(),
    db.client.findMany({ orderBy: { created: 'desc' }, take: 5, select: { id: true, name: true, business: true, created: true, status: true } }),
    db.changeRequest.findMany({ orderBy: { created: 'desc' }, take: 8, select: { id: true, title: true, status: true, created: true, client_id: true } }),
    db.changeRequest.count({ where: { status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
  ])

  const reqClientIds = [...new Set(recentRequests.map(r => r.client_id))]
  const reqClients = await db.client.findMany({ where: { id: { in: reqClientIds } }, select: { id: true, name: true, business: true } })
  const clientMap = Object.fromEntries(reqClients.map(c => [c.id, c]))

  const monthlyRevenue = recurringIncomeResult.reduce((sum, item) => sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount), 0)
  const firstName = user?.firstName ?? 'Nick'

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">{getGreeting()}, {firstName}</h1>
        <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </header>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { label: 'Active Clients', value: totalClients.toString(), href: '/admin/clients', urgent: false },
          { label: 'Active Projects', value: activeProjects.toString(), href: '/admin/projects', urgent: false },
          { label: 'Monthly Revenue', value: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(monthlyRevenue), href: '/admin/finances', urgent: false },
          { label: 'Open Requests', value: pendingRequests.toString(), href: '/admin/clients', urgent: pendingRequests > 0 },
        ].map((card) => (
          <Link key={card.label} href={card.href} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm hover:border-blue-200 transition">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className={`mt-2 font-sans text-3xl font-semibold tracking-tight ${card.urgent ? 'text-amber-600' : 'text-slate-900'}`}>{card.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-base font-semibold text-gray-900">Change Requests</h2>
            {pendingRequests > 0 && <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-700">{pendingRequests} open</span>}
          </div>
          <div className="space-y-1">
            {recentRequests.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No requests yet.</p>
            ) : recentRequests.map((req) => {
              const client = clientMap[req.client_id]
              return (
                <div key={req.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.title}</p>
                    <p className="text-xs text-gray-400">{client?.business || client?.name || '—'}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${req.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : req.status === 'IN_PROGRESS' ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{req.status.replace('_', ' ')}</span>
                </div>
              )
            })}
          </div>
        </section>
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-sans text-base font-semibold text-gray-900">Recent Clients</h2>
            <Link href="/admin/clients" className="text-xs text-blue-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-1">
            {recentClients.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No clients yet.</p>
            ) : recentClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 hover:bg-gray-50 transition">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{client.business || client.name}</p>
                  <p className="text-xs text-gray-400">{new Date(client.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border flex-shrink-0 ${client.status === 'ACTIVE' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{client.status}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="font-sans text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {quickActions.map((action) => (
            <Link key={action.label} href={action.href} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-blue-600 hover:shadow-md">
              <span className="block text-sm font-semibold text-gray-900">{action.label}</span>
              <span className="block text-xs text-gray-400 mt-0.5">{action.description}</span>
            </Link>
          ))}
        </div>
      </section>
    </section>
  )
}
