import { db } from '@/lib/db'
import TimeTracker from '@/components/admin/TimeTracker'

export const dynamic = 'force-dynamic'

export default async function TimePage() {
  const [entries, clients, projects] = await Promise.all([
    db.timeEntry.findMany({ orderBy: { created: 'desc' } }),
    db.client.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, business: true },
    }),
    db.project.findMany({
      where: { status: { in: ['ACTIVE', 'IN_PROGRESS', 'PENDING'] } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, client_id: true },
    }),
  ])

  // Resolve client/project names for each entry
  const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
  const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

  const enrichedEntries = entries.map(e => ({
    ...e,
    client: clientMap[e.client_id] ?? null,
    project: e.project_id ? (projectMap[e.project_id] ?? null) : null,
  }))

  return (
    <section className="space-y-8">
      <header className="space-y-1">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Time Log</h1>
        <p className="text-sm text-gray-500">Track billable hours across clients and projects.</p>
      </header>

      <TimeTracker
        initialEntries={enrichedEntries}
        clients={clients}
        proje