import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import {
  stripe,
  PLAN_FEATURES,
  LAPSED_FEATURES,
  PlanKey,
  PLANS,
  subscriptionPeriod,
  PlanFeatures,
} from '@/lib/stripe'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook
//
// Ordering guarantees we rely on:
//   1. Signature verified first — unsigned events are rejected with 400.
//   2. Event deduplicated via processed_stripe_events — replays no-op.
//   3. Handler errors return 500 so Stripe retries. All handlers use idempotent
//      upserts/updateMany so a retry after partial success converges.
//   4. The dedup row is only written at the end, so partial failure → Stripe
//      retry → whole event re-processed (safe thanks to idempotent writes).
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency short-circuit. If we've already processed this event id,
  // acknowledge with 200 so Stripe stops retrying.
  const already = await db.processedStripeEvent.findUnique({
    where: { event_id: event.id },
  })
  if (already) {
    return NextResponse.json({ received: true, deduped: true })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session)
        break
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        await handleSubscriptionSync(event.data.object as Stripe.Subscription)
        break
      }

      case 'customer.subscription.deleted': {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break
      }

      case 'invoice.paid': {
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break
      }

      case 'charge.refunded': {
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break
      }

      case 'charge.dispute.created': {
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break
      }

      default:
        // Ignored event type — still log the dedup row so retries short-circuit.
        break
    }

    // Mark processed.
    await db.processedStripeEvent.create({
      data: { event_id: event.id, event_type: event.type },
    })
  } catch (err) {
    console.error(`[stripe webhook] handler failed for ${event.type} ${event.id}:`, err)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─────────────────────────────────────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const clientId = session.metadata?.client_id
  const planKey  = session.metadata?.plan_key as PlanKey | undefined
  const planName = session.metadata?.plan_name ?? 'Unknown'

  if (!clientId || !planKey || !(planKey in PLANS)) {
    console.warn('[stripe webhook] checkout.session.completed missing metadata', {
      clientId, planKey, session_id: session.id,
    })
    return
  }

  const plan = PLANS[planKey]

  if (session.mode === 'subscription' && session.subscription) {
    const sub = await stripe.subscriptions.retrieve(session.subscription as string)
    const { start, end } = subscriptionPeriod(sub)

    await db.subscription.upsert({
      where:  { stripe_subscription_id: sub.id },
      create: {
        client_id:               clientId,
        stripe_subscription_id:  sub.id,
        stripe_customer_id:      sub.customer as string,
        plan_key:                planKey,
        plan_name:               planName,
        plan_type:               'MONTHLY',
        status:                  sub.status.toUpperCase(),
        amount_cents:            plan.amount,
        current_period_start:    start,
        current_period_end:      end,
        cancel_at_period_end:    sub.cancel_at_period_end,
      },
      update: {
        client_id:               clientId,
        stripe_customer_id:      sub.customer as string,
        plan_key:                planKey,
        plan_name:               planName,
        status:                  sub.status.toUpperCase(),
        amount_cents:            plan.amount,
        current_period_start:    start,
        current_period_end:      end,
        cancel_at_period_end:    sub.cancel_at_period_end,
      },
    })

    await applyFeaturesToClient(clientId, PLAN_FEATURES[planKey])
    await activateClient(clientId)
  } else if (session.mode === 'payment') {
    // One-time build — record in payments table, don't touch subscriptions.
    await db.payment.upsert({
      where:  { stripe_checkout_session: session.id },
      create: {
        client_id:               clientId,
        stripe_customer_id:      session.customer as string | null,
        stripe_checkout_session: session.id,
        stripe_payment_intent:   (session.payment_intent as string | null) ?? null,
        plan_key:                planKey,
        plan_name:               planName,
        status:                  'PAID',
        amount_cents:            session.amount_total ?? plan.amount,
      },
      update: {
        stripe_customer_id:    session.customer as string | null,
        stripe_payment_intent: (session.payment_intent as string | null) ?? null,
        plan_key:              planKey,
        plan_name:             planName,
        status:                'PAID',
        amount_cents:          session.amount_total ?? plan.amount,
      },
    })

    await applyFeaturesToClient(clientId, PLAN_FEATURES[planKey])
    await activateClient(clientId)
  }
}

async function handleSubscriptionSync(sub: Stripe.Subscription) {
  const { start, end } = subscriptionPeriod(sub)
  const status         = sub.status.toUpperCase()

  const updated = await db.subscription.updateMany({
    where: { stripe_subscription_id: sub.id },
    data: {
      status,
      current_period_start: start,
      current_period_end:   end,
      cancel_at_period_end: sub.cancel_at_period_end,
    },
  })

  if (updated.count === 0) {
    // Subscription created outside of a checkout (e.g. admin created it in
    // the Stripe dashboard). We don't know the client — log and move on.
    console.warn('[stripe webhook] subscription sync for untracked sub', sub.id)
    return
  }

  if (status === 'PAST_DUE' || status === 'UNPAID' || status === 'CANCELED' || status === 'CANCELLED') {
    const row = await db.subscription.findFirst({
      where: { stripe_subscription_id: sub.id },
      select: { client_id: true },
    })
    if (row) await applyFeaturesToClient(row.client_id, LAPSED_FEATURES)
  } else if (status === 'ACTIVE' || status === 'TRIALING') {
    const row = await db.subscription.findFirst({
      where: { stripe_subscription_id: sub.id },
      select: { client_id: true, plan_key: true },
    })
    if (row?.plan_key && row.plan_key in PLAN_FEATURES) {
      await applyFeaturesToClient(row.client_id, PLAN_FEATURES[row.plan_key as PlanKey])
    }
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db.subscription.updateMany({
    where: { stripe_subscription_id: sub.id },
    data:  { status: 'CANCELLED' },
  })

  const row = await db.subscription.findFirst({
    where:  { stripe_subscription_id: sub.id },
    select: { client_id: true },
  })
  if (row) await applyFeaturesToClient(row.client_id, LAPSED_FEATURES)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = extractInvoiceSubscriptionId(invoice)
  if (!subId) return

  await db.subscription.updateMany({
    where: { stripe_subscription_id: subId },
    data:  { status: 'PAST_DUE' },
  })

  const row = await db.subscription.findFirst({
    where:  { stripe_subscription_id: subId },
    select: { client_id: true },
  })
  if (row) await applyFeaturesToClient(row.client_id, LAPSED_FEATURES)
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Successful renewal — refresh status from Stripe since the subscription
  // period may have advanced.
  const subId = extractInvoiceSubscriptionId(invoice)
  if (!subId) return

  const sub = await stripe.subscriptions.retrieve(subId)
  await handleSubscriptionSync(sub)
}

async function handleChargeRefunded(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : null
  if (!pi) return

  await db.payment.updateMany({
    where: { stripe_payment_intent: pi },
    data:  { status: 'REFUNDED' },
  })
}

async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const pi = typeof dispute.payment_intent === 'string' ? dispute.payment_intent : null
  if (pi) {
    await db.payment.updateMany({
      where: { stripe_payment_intent: pi },
      data:  { status: 'DISPUTED' },
    })
  }
  // Chargebacks are severe — log prominently.
  console.error('[stripe webhook] dispute created', {
    dispute_id: dispute.id,
    reason:     dispute.reason,
    amount:     dispute.amount,
    charge:     dispute.charge,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function applyFeaturesToClient(clientId: string, features: PlanFeatures) {
  await db.clientConfig.upsert({
    where:  { client_id: clientId },
    create: { client_id: clientId, ...features },
    update: features,
  })
}

async function activateClient(clientId: string) {
  await db.client.update({
    where: { id: clientId },
    data:  { status: 'ACTIVE' },
  })
}

// Stripe has moved the subscription reference around across API versions.
// Check every known location so this survives version bumps.
type InvoiceSubShape = {
  subscription?: string | Stripe.Subscription | null
  parent?: {
    subscription_details?: { subscription?: string | Stripe.Subscription | null }
  }
  lines?: { data: Array<{ subscription?: string | null }> }
}

function extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as InvoiceSubShape

  const top = inv.subscription
  if (typeof top === 'string') return top
  if (top && typeof top === 'object' && 'id' in top) return (top as Stripe.Subscription).id

  const nested = inv.parent?.subscription_details?.subscription
  if (typeof nested === 'string') return nested
  if (nested && typeof nested === 'object' && 'id' in nested) return (nested as Stripe.Subscription).id

  const fromLine = inv.lines?.data?.[0]?.subscription
  if (typeof fromLine === 'string') return fromLine

  return null
}
