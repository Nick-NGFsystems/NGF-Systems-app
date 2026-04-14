import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function PortalDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const client = await getClientConfig(userId)
  if (!client) redirect('/unauthorized')
  const [activeProjects, openRequests, nextInvoice] = await Promise.all([
    db.project.count({ where: { client_id: client.id, status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    db.changeRequest.count({ where: { client_id: client.id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    db.invoice.findFirst({ where: { client_id: client.id, status: { in: ['PENDING', 'SENT'] } }, orderBy: { due_date: 'asc' }, select: { due_date: true, amount: true } }),
  ])
  const config = client.config
  const hasWebsite = !!config?.page_website
  const hasSiteUrl = !!config?.site_url
  const quickActions = [
    hasWebsite && { label: 'Website Editor', href: '/portal/website', desc: 'Edit your website content', icon: '&#x270F;&#xFE0F;' },
    hasWebsite && { label: 'My Website', href: '/portal/portal-website', desc: 'View & submit change requests', icon: '&#x1F310;' },
    config?.page_invoices && { label: 'Invoices', href: '/portal/portal-invoices', desc: 'View your invoices', icon: '&#x1F4B3;' },
    config?.page_request && { label: 'Request Form', href: '/portal/portal-request', desc: 'Submit a new project request', icon: '&#x1F4C4;' },
  ].filter(Boolean) as { label: string; href: string; desc: string; icon: string }[]
  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">{client.business || client.name}</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Active Projects</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeProjects}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Open Requests</p>
          <p className={`mt-2 text-3xl font-semibold ${openRequests > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{openRequests}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Next Invoice Due</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{nextInvoice?.due_date ? new Date(nextInvoice.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '&#x2014;'}</p>
        </article>
      </div>
      {hasWebsite && (
        <section className="rounded-xl border border-blue-100 bg-blue-50 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-blue-900">Your Website</h2>
              {hasSiteUrl ? (
                <p className="mt-1 text-sm text-blue-700">Your website editor is active. Click a field to edit, then push to make it live.</p>
              ) : (
                <p className="mt-1 text-sm text-blue-700">Your website is being set up. The editor will be available once your site is live.</p>
              )}
            </div>
            {hasSiteUrl && (
              <Link href="/portal/website" className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">Open Editor</Link>
            )}
          </div>
        </section>
      )}
      {quickActions.length > 0 && (
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-sans text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href} className="flex items-center gap-4 rounded-xl border border-gray-100 p-4 hover:border-blue-300 hover:bg-blue-50/30 transition">
                <span className="text-2xl" dangerouslySetInnerHTML={{ __html: action.icon }} />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{action.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
