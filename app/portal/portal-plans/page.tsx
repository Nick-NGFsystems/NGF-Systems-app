import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import { db } from '@/lib/db'
import { PLANS, PlanKey } from '@/lib/stripe'
import SubscribeButton from '@/components/portal/SubscribeButton'

export const dynamic = 'force-dynamic'

function dollars(cents: number): number {
  return Math.round(cents) / 100
}

const SUBSCRIPTION_KEYS: PlanKey[] = ['starter_monthly', 'professional_monthly', 'premium_monthly']
const ONE_TIME_KEYS:     PlanKey[] = ['essential_onetime', 'business_onetime']

const PLAN_COPY: Record<PlanKey, { tagline: string; bullets: string[]; highlight?: boolean }> = {
  starter_monthly: {
    tagline: 'For small businesses that want a managed website and a simple portal.',
    bullets: [
      'Website content editor',
      'Request changes via portal',
      'Invoice history',
      'Email support',
    ],
  },
  professional_monthly: {
    tagline: 'For growing businesses that need blog, products, and a gallery.',
    bullets: [
      'Everything in Starter',
      'Blog and products modules',
      'Gallery section',
      'Priority email support',
    ],
    highlight: true,
  },
  premium_monthly: {
    tagline: 'Full-featured plan including bookings and priority support.',
    bullets: [
      'Everything in Professional',
      'Online bookings module',
      'Priority phone/email support',
      'Quarterly strategy review',
    ],
  },
  essential_onetime: {
    tagline: 'One-time website build — essential package.',
    bullets: [
      'Up to 5 pages',
      'Mobile-responsive design',
      'Launch-ready deploy',
      'Portal access for invoices',
    ],
  },
  business_onetime: {
    tagline: 'One-time build with more pages and custom integrations.',
    bullets: [
      'Up to 10 pages',
      'Custom design system',
      'Third-party integrations',
      'Portal access for invoices',
    ],
  },
}

export default async function PortalPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const client = await getClientConfig(userId)
  if (!client) redirect('/unauthorized')

  const params    = await searchParams
  const cancelled = params.checkout === 'cancelled'

  const activeSub = await db.subscription.findFirst({
    where:   { client_id: client.id, status: { in: ['ACTIVE', 'TRIALING'] } },
    orderBy: { created: 'desc' },
    select:  { plan_key: true, plan_name: true, current_period_end: true },
  })

  return (
    <section className="space-y-10">
      <header className="space-y-2">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">
          Choose your plan
        </h1>
        <p className="text-sm text-gray-500">
          All plans include the client portal and ongoing support. Cancel or change any time.
        </p>

        {cancelled ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Checkout was cancelled — no charges were made. Pick a plan below to try again.
          </div>
        ) : null}

        {activeSub ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You&apos;re currently on the <strong>{activeSub.plan_name}</strong> plan.
            {activeSub.current_period_end ? (
              <> Renews on {activeSub.current_period_end.toLocaleDateString()}.</>
            ) : null}{' '}
            <a href="/portal/portal-invoices" className="underline underline-offset-2">
              Manage billing
            </a>
            .
          </div>
        ) : null}
      </header>

      <section aria-labelledby="subs-heading" className="space-y-4">
        <h2 id="subs-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Monthly managed plans
        </h2>

        <div className="grid gap-4 md:grid-cols-3">
          {SUBSCRIPTION_KEYS.map((key) => {
            const plan      = PLANS[key]
            const copy      = PLAN_COPY[key]
            const isCurrent = activeSub?.plan_key === key

            return (
              <article
                key={key}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  copy.highlight ? 'border-slate-900 ring-1 ring-slate-900' : 'border-gray-200'
                }`}
              >
                {copy.highlight ? (
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-slate-900 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                    Most popular
                  </span>
                ) : null}

                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 min-h-[40px] text-sm text-gray-500">{copy.tagline}</p>

                <div className="mt-5">
                  <span className="text-4xl font-semibold tracking-tight text-slate-900">
                    ${dollars(plan.amount)}
                  </span>
                  <span className="ml-1 text-sm text-gray-500">/mo</span>
                </div>
                {plan.setupFee > 0 ? (
                  <p className="mt-1 text-xs text-gray-500">
                    + one-time ${dollars(plan.setupFee)} setup fee on first invoice
                  </p>
                ) : null}

                <ul className="mt-5 space-y-2 text-sm text-gray-700">
                  {copy.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-8.25 8.25a1 1 0 01-1.414 0L3.296 10.91a1 1 0 011.414-1.414l3.036 3.036 7.543-7.243a1 1 0 011.415 0z" clipRule="evenodd" />
                      </svg>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex-1" />

                {isCurrent ? (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center text-sm font-medium text-emerald-900">
                    Your current plan
                  </div>
                ) : (
                  <SubscribeButton planKey={key}>
                    {activeSub ? 'Switch to this plan' : 'Subscribe'}
                  </SubscribeButton>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="build-heading" className="space-y-4">
        <h2 id="build-heading" className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          One-time builds
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {ONE_TIME_KEYS.map((key) => {
            const plan = PLANS[key]
            const copy = PLAN_COPY[key]

            return (
              <article key={key} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{copy.tagline}</p>

                <div className="mt-5">
                  <span className="text-4xl font-semibold tracking-tight text-slate-900">
                    ${dollars(plan.amount).toLocaleString()}
                  </span>
                  <span className="ml-1 text-sm text-gray-500">one-time</span>
                </div>

                <ul className="mt-5 space-y-2 text-sm text-gray-700">
                  {copy.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M16.704 5.29a1 1 0 010 1.42l-8.25 8.25a1 1 0 01-1.414 0L3.296 10.91a1 1 0 011.414-1.414l3.036 3.036 7.543-7.243a1 1 0 011.415 0z" clipRule="evenodd" />
                      </svg>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-6 flex-1" />

                <SubscribeButton
                  planKey={key}
                  className="w-full rounded-lg border border-slate-900 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Get started
                </SubscribeButton>
              </article>
            )
          })}
        </div>
      </section>

      <p className="pt-2 text-xs text-gray-500">
        Checkout is processed by Stripe. You&apos;ll see a secure payment page before being charged.
      </p>
    </section>
  )
}
