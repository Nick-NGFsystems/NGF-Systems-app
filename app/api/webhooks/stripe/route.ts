import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe, subscriptionPeriod } from '@/lib/stripe'
import { db } from '@/lib/db'

// ─────────────────────────────────────────────────────────────────────────────
// Stripe webhook
//
// Responsibilities:
//   1. Signature verification (reject unsigned).
//   2. Idempotency via processed_stripe_events (short-circuit replays).
//   3. Mirror Stripe state into our DB (Subscription + Payment rows).
//   4. Do NOT touch ClientConfig feature toggles — admin controls those
//      manually in the portal config UI.
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

  // Idempotency short-circuit
  const already = await db.processedStripeEvent.findUnique({ where: { event_id: event.id } })
  if (already) {
    return NextResponse.json({ received: true, deduped: true })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge)
        break

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute)
        break

      default:
        // Ignored event type; still log for dedup.
        break
    }

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
// Subscription handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleSubscriptionCreated(sub: Stripe.Subscription) {
  const clientId = sub.metadata?.client_id
  const planKey  = sub.metadata?.plan_key ?? null
  const planName = sub.metadata?.plan_name ?? 'Managed Subscription'

  if (!clientId) {
    console.warn('[stripe webhook] subscription.created missing client_id metadata', { sub_id: sub.id })
    return
  }

  const { start, end }  = subscriptionPeriod(sub)
  const firstItemAmount = sub.items.data[0]?.price.unit_amount ?? 0
  const interval        = sub.items.data[0]?.price.recurring?.interval ?? 'month'
  const planType        = interval === 'year' ? 'YEARLY' : 'MONTHLY'

  await db.subscription.upsert({
    where: { stripe_subscription_id: sub.id },
    create: {
      client_id:               clientId,
      stripe_subscription_id:  sub.id,
      stripe_customer_id:      sub.customer as string,
      plan_key:                planKey,
      plan_name:               planName,
      plan_type:               planType,
      status:                  sub.status.toUpperCase(),
      amount_cents:            firstItemAmount,
      current_period_start:    start,
      current_period_end:      end,
      cancel_at_period_end:    sub.cancel_at_period_end,
    },
    update: {
      // If we somehow see .created for an already-tracked sub, just sync.
      stripe_customer_id:      sub.customer as string,
      status:                  sub.status.toUpperCase(),
      amount_cents:            firstItemAmount,
      current_period_start:    start,
      current_period_end:      end,
      cancel_at_period_end:    sub.cancel_at_period_end,
    },
  })
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription) {
  const { start, end }  = subscriptionPeriod(sub)
  const firstItemAmount = sub.items.data[0]?.price.unit_amount ?? 0

  const updated = await db.subscription.updateMany({
    where: { stripe_subscription_id: sub.id },
    data: {
      status:                sub.status.toUpperCase(),
      amount_cents:          firstItemAmount,
      current_period_start:  start,
      current_period_end:    end,
      cancel_at_period_end:  sub.cancel_at_period_end,
    },
  })

  if (updated.count === 0) {
    // Sub created outside our system (e.g. directly in Stripe dashboard).
    // Treat as create if metadata has a client_id, else log and move on.
    if (sub.metadata?.client_id) {
      await handleSubscriptionCreated(sub)
    } else {
      console.warn('[stripe webhook] untracked subscription updated', sub.id)
    }
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await db.subscription.updateMany({
    where: { stripe_subscription_id: sub.id },
    data:  { status: 'CANCELLED' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Invoice handlers
// ─────────────────────────────────────────────────────────────────────────────

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Record the payment for history.
  const customerId  = (typeof invoice.customer === 'string') ? invoice.customer : invoice.customer?.id ?? null
  const paymentIntent = (typeof (invoice as unknown as { payment_intent?: string | null }).payment_intent === 'string')
    ? (invoice as unknown as { payment_intent: string }).payment_intent
    : null

  // Find the client from the customer ID.
  const client = customerId
    ? await db.client.findFirst({ where: { stripe_customer_id: customerId }, select: { id: true } })
    : null

  const clientId = invoice.metadata?.client_id ?? client?.id ?? null

  if (!clientId) {
    console.warn('[stripe webhook] invoice.paid with no resolvable client', { invoice_id: invoice.id, customerId })
    // Still refresh sub status below even if we can't record the payment.
  } else if (invoice.id) {
    await db.payment.upsert({
      where:  { stripe_checkout_session: invoice.id }, // repurpose this column as "stripe_invoice_id" for invoice-based payments
      create: {
        client_id:                clientId,
        stripe_customer_id:       customerId,
        stripe_checkout_session:  invoice.id,          // invoice id, not checkout session
        stripe_payment_intent:    paymentIntent,
        plan_key:                 invoice.metadata?.plan_key ?? null,
        plan_name:                invoice.description ?? invoice.lines.data[0]?.description ?? 'Invoice',
        status:                   'PAID',
        amount_cents:             invoice.amount_paid ?? invoice.total ?? 0,
      },
      update: {
        stripe_customer_id:    customerId,
        stripe_payment_intent: paymentIntent,
        status:                'PAID',
        amount_cents:          invoice.amount_paid ?? invoice.total ?? 0,
      },
    })
  }

  // Refresh the related subscription status (period may have advanced).
  const subId = extractInvoiceSubscriptionId(invoice)
  if (subId) {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      await handleSubscriptionUpdated(sub)
    } catch (err) {
      console.warn('[stripe webhook] could not re-fetch subscription', { subId, err })
    }
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subId = extractInvoiceSubscriptionId(invoice)
  if (!subId) return
  await db.subscription.updateMany({
    where: { stripe_subscription_id: subId },
    data:  { status: 'PAST_DUE' },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Charge handlers
// ─────────────────────────────────────────────────────────────────────────────

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

type InvoiceSubShape = {
  subscription?: string | Stripe.Subscription | null
  parent?: { subscription_details?: { subscription?: string | Stripe.Subscription | null } }
  lines?:  { data: Array<{ subscription?: string | null }> }
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
