import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { stripe } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const clientId = session.metadata?.client_id
        const planName = session.metadata?.plan_name ?? 'Unknown'

        if (!clientId) break

        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          await db.subscription.upsert({
            where: { client_id: clientId },
            create: {
              client_id: clientId,
              stripe_subscription_id: sub.id,
              stripe_customer_id: sub.customer as string,
              plan_name: planName,
              plan_type: 'MONTHLY',
              status: sub.status.toUpperCase(),
              amount_cents: sub.items.data[0]?.price.unit_amount ?? 0,
              current_period_start: new Date((sub as any).current_period_start * 1000),
              current_period_end: new Date((sub as any).current_period_end * 1000),
            },
            update: {
              stripe_subscription_id: sub.id,
              stripe_customer_id: sub.customer as string,
              plan_name: planName,
              status: sub.status.toUpperCase(),
              amount_cents: sub.items.data[0]?.price.unit_amount ?? 0,
              current_period_start: new Date((sub as any).current_period_start * 1000),
              current_period_end: new Date((sub as any).current_period_end * 1000),
            },
          })
        } else if (session.mode === 'payment') {
          await db.subscription.upsert({
            where: { client_id: clientId },
            create: {
              client_id: clientId,
              stripe_customer_id: session.customer as string,
              plan_name: planName,
              plan_type: 'ONETIME',
              status: 'PAID',
              amount_cents: session.amount_total ?? 0,
            },
            update: {
              stripe_customer_id: session.customer as string,
              plan_name: planName,
              status: 'PAID',
              amount_cents: session.amount_total ?? 0,
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await db.subscription.updateMany({
          where: { stripe_subscription_id: sub.id },
          data: {
            status: sub.status.toUpperCase(),
            cancel_at_period_end: sub.cancel_at_period_end,
            current_period_start: new Date((sub as any).current_period_start * 1000),
            current_period_end: new Date((sub as any).current_period_end * 1000),
          },
        })
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await db.subscription.updateMany({
          where: { stripe_subscription_id: sub.id },
          data: { status: 'CANCELLED' },
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const invoiceSub = (invoice as any).parent?.subscription_details?.subscription ?? (invoice as any).subscription
        if (invoiceSub) {
          await db.subscription.updateMany({
            where: { stripe_subscription_id: invoiceSub as string },
            data: { status: 'PAST_DUE' },
          })
        }
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`Error handling Stripe event ${event.type}:`, err)
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
