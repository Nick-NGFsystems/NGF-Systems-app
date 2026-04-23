import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import {
  stripe,
  createSubscriptionForClient,
  createOneTimeInvoice,
  cancelSubscriptionAtPeriodEnd,
  resumeSubscription,
  cancelSubscriptionImmediately,
  getOrCreateStripeCustomer,
} from '@/lib/stripe'

// ─────────────────────────────────────────────────────────────────────────────
// /api/admin/clients/[id]/billing
//
// Role-gated: admin only.
//
// GET  → current state for the Billing card on the client detail page.
// POST → actions: create_subscription | create_invoice |
//        cancel_subscription | resume_subscription | cancel_subscription_now
// ─────────────────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const client = await db.client.findUnique({ where: { id } })
  if (!client) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
  }

  // DB mirror — fast, reflects what webhooks have synced.
  const [subscriptions, payments] = await Promise.all([
    db.subscription.findMany({
      where: { client_id: id },
      orderBy: { created: 'desc' },
    }),
    db.payment.findMany({
      where: { client_id: id },
      orderBy: { created: 'desc' },
      take: 25,
    }),
  ])

  // Live data from Stripe for richer admin view (optional — tolerate failure).
  let stripeInvoices: Array<{
    id: string
    hosted_invoice_url: string | null
    status: string | null
    amount_due: number
    amount_paid: number
    created: number
    number: string | null
  }> = []

  if (client.stripe_customer_id) {
    try {
      const list = await stripe.invoices.list({
        customer: client.stripe_customer_id,
        limit:    20,
      })
      stripeInvoices = list.data.map((inv) => ({
        id:                 inv.id ?? '',
        hosted_invoice_url: inv.hosted_invoice_url ?? null,
        status:             inv.status ?? null,
        amount_due:         inv.amount_due,
        amount_paid:        inv.amount_paid,
        created:            inv.created,
        number:             inv.number ?? null,
      }))
    } catch (err) {
      console.error('[admin/billing GET] Stripe invoices fetch failed', err)
    }
  }

  const stripeDashboardUrl = client.stripe_customer_id
    ? `https://dashboard.stripe.com/customers/${client.stripe_customer_id}`
    : null

  return NextResponse.json({
    success: true,
    data: {
      client_id:            client.id,
      stripe_customer_id:   client.stripe_customer_id,
      stripe_dashboard_url: stripeDashboardUrl,
      subscriptions,
      payments,
      stripe_invoices:      stripeInvoices,
    },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : null

  const client = await db.client.findUnique({ where: { id } })
  if (!client) {
    return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
  }

  try {
    switch (action) {
      case 'ensure_customer': {
        const customerId = await getOrCreateStripeCustomer(client)
        return NextResponse.json({ success: true, data: { stripe_customer_id: customerId } })
      }

      case 'create_subscription': {
        const amountCents = Number(body.amount_cents)
        const interval   = body.interval === 'year' ? 'year' : 'month'
        const description = typeof body.description === 'string' ? body.description : undefined
        const presetKey   = typeof body.preset_key === 'string' ? body.preset_key : undefined

        if (!Number.isFinite(amountCents) || amountCents < 50) {
          return NextResponse.json({ success: false, error: 'amount_cents must be at least 50' }, { status: 400 })
        }

        const sub = await createSubscriptionForClient({
          clientId: id, amountCents, interval, description, presetKey,
        })
        return NextResponse.json({ success: true, data: { subscription_id: sub.id, status: sub.status } })
      }

      case 'create_invoice': {
        const amountCents = Number(body.amount_cents)
        const description = typeof body.description === 'string' ? body.description.trim() : ''

        if (!Number.isFinite(amountCents) || amountCents < 50) {
          return NextResponse.json({ success: false, error: 'amount_cents must be at least 50' }, { status: 400 })
        }
        if (!description) {
          return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 })
        }

        const inv = await createOneTimeInvoice({ clientId: id, amountCents, description })
        return NextResponse.json({
          success: true,
          data: {
            invoice_id:         inv.id,
            hosted_invoice_url: inv.hosted_invoice_url,
            status:             inv.status,
          },
        })
      }

      case 'cancel_subscription': {
        const subId = typeof body.subscription_id === 'string' ? body.subscription_id : null
        if (!subId) {
          return NextResponse.json({ success: false, error: 'subscription_id required' }, { status: 400 })
        }
        const sub = await cancelSubscriptionAtPeriodEnd(subId)
        return NextResponse.json({ success: true, data: { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end } })
      }

      case 'resume_subscription': {
        const subId = typeof body.subscription_id === 'string' ? body.subscription_id : null
        if (!subId) {
          return NextResponse.json({ success: false, error: 'subscription_id required' }, { status: 400 })
        }
        const sub = await resumeSubscription(subId)
        return NextResponse.json({ success: true, data: { status: sub.status, cancel_at_period_end: sub.cancel_at_period_end } })
      }

      case 'cancel_subscription_now': {
        const subId = typeof body.subscription_id === 'string' ? body.subscription_id : null
        if (!subId) {
          return NextResponse.json({ success: false, error: 'subscription_id required' }, { status: 400 })
        }
        const sub = await cancelSubscriptionImmediately(subId)
        return NextResponse.json({ success: true, data: { status: sub.status } })
      }

      default:
        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[admin/billing POST]', action, err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
