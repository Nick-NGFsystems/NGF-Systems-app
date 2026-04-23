import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe, PLANS, PlanKey, appUrl } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { planKey, successUrl, cancelUrl } = await req.json()

    if (!planKey || !(planKey in PLANS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const plan = PLANS[planKey as PlanKey]
    const base = appUrl()

    // Find the client record and their Stripe customer ID.
    const client = await db.client.findFirst({
      where: { clerk_user_id: userId },
    })

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    }

    // Get or create Stripe customer.
    let stripeCustomerId = client.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email:    client.email ?? undefined,
        name:     client.name ?? client.business ?? undefined,
        metadata: { client_id: client.id, clerk_user_id: userId },
      })
      stripeCustomerId = customer.id
      await db.client.update({
        where: { id: client.id },
        data:  { stripe_customer_id: stripeCustomerId },
      })
    }

    // Build the checkout session. We reference real Stripe Price IDs so the
    // Stripe dashboard stays clean and reporting works.
    const metadata = {
      client_id: client.id,
      plan_key:  planKey,
      plan_name: plan.name,
      plan_type: plan.type,
    }

    // Base line items: the plan itself. For subscriptions, the setup fee
    // is appended as a second one-time line item — Stripe Checkout combines
    // it with the first invoice automatically so the client sees one charge.
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      { price: plan.priceId, quantity: 1 },
    ]

    if (plan.type === 'monthly' && plan.setupFeePriceId) {
      lineItems.push({ price: plan.setupFeePriceId, quantity: 1 })
    }

    const commonParams: Stripe.Checkout.SessionCreateParams = {
      customer:    stripeCustomerId,
      line_items:  lineItems,
      success_url: successUrl ?? `${base}/portal/portal-dashboard?checkout=success`,
      cancel_url:  cancelUrl  ?? `${base}/portal/portal-plans?checkout=cancelled`,
      metadata,
    }

    const session: Stripe.Checkout.Session =
      plan.type === 'monthly'
        ? await stripe.checkout.sessions.create({
            ...commonParams,
            mode:              'subscription',
            subscription_data: { metadata },
          })
        : await stripe.checkout.sessions.create({
            ...commonParams,
            mode:                'payment',
            payment_intent_data: { metadata },
          })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe create-checkout]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
