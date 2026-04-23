import { auth } from '@clerk/nextjs/server'
import type { ReactElement } from 'react'
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

  const [activeProjects, openRequests, subscription] = await Promise.all([
    db.project.count({ where: { client_id: client.id, status: { in: ['ACTIVE', 'IN_PROGRESS'] } } }),
    db.changeRequest.count({ where: { client_id: client.id, status: { in: ['PENDING', 'IN_PROGRESS'] } } }),
    db.subscription.findFirst({
      where:   { client_id: client.id },
      orderBy: { created: 'desc' },
      select:  { current_period_end: true, status: true },
    }),
  ])

  const config = client.config
  const hasWebsite = !!config?.page_website
  const hasSiteUrl = !!config?.site_url

  const quickActions = [
    hasWebsite ? {
      label: 'Website Editor',
      href: '/portal/website',
      desc: 'Edit your website content',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
    } : null,
    hasWebsite ? {
      label: 'My Website',
      href: '/portal/portal-website',
      desc: 'View & submit change requests',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
    } : null,
    config?.page_invoices ? {
      label: 'Invoices',
      href: '/portal/portal-invoices',
      desc: 'View your invoices',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
    } : null,
    config?.page_request ? {
      label: 'Request Form',
      href: '/portal/portal-request',
      desc: 'Submit a new project request',
      icon: (
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    } : null,
  ].filter((a): a is { label: string; href: string; desc: string; icon: ReactElement } => a !== null)

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
          <p className="text-sm text-gray-500">Subscription</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {subscription?.current_period_end
              ? new Date(subscription.current_period_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              : '—'}
          </p>
          {subscription?.status && (
            <p className={`mt-1 text-xs font-medium ${subscription.status === 'ACTIVE' ? 'text-emerald-600' : 'text-gray-400'}`}>{subscription.status}</p>
          )}
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
              <Link href="/portal/website" className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Open Editor
              </Link>
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
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  {action.icon}
                </div>
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
