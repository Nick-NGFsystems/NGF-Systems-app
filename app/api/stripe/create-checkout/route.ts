import Stripe from 'stripe'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe, PLANS, PlanKey } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { planKey, successUrl, cancelUrl } = await req.json()

  if (!planKey || !(planKey in PLANS)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const plan = PLANS[planKey as PlanKey]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.ngfsystems.com'

  // Find the client record and their Stripe customer ID
  const client = await db.client.findFirst({
    where: { clerk_user_id: userId },
  })

  if (!client) {
    return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  }

  // Get or create Stripe customer
  let stripeCustomerId = client.stripe_customer_id

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: client.email ?? undefined,
      name: client.name ?? client.business ?? undefined,
      metadata: { client_id: client.id, clerk_user_id: userId },
    })
    stripeCustomerId = customer.id
    await db.client.update({
      where: { id: client.id },
      data: { stripe_customer_id: stripeCustomerId },
    })
  }

  // Build line items
  const lineItems: { price_data: object; quantity: number }[] = []

  if (plan.type === 'monthly') {
    // Recurring subscription
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: `NGF Systems — ${plan.name} Plan` },
        unit_amount: plan.amount,
        recurring: { interval: 'month' },
      },
      quantity: 1,
    })
    // Setup fee as a one-time add-on (if any)
    if (plan.setupFee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `${plan.name} Plan — Setup Fee` },
          unit_amount: plan.setupFee,
        },
        quantity: 1,
      })
    }
  } else {
    // One-time payment
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: `NGF Systems — ${plan.name} Build` },
        unit_amount: plan.amount,
      },
      quantity: 1,
    })
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: plan.type === 'monthly' ? 'subscription' : 'payment',
    line_items: lineItems as Stripe.Checkout.SessionCreateParams.LineItem[],
    success_url: successUrl ?? `${appUrl}/portal?checkout=success`,
    cancel_url: cancelUrl ?? `${appUrl}/portal?checkout=cancelled`,
    metadata: {
      client_id: client.id,
      plan_key: planKey,
      plan_name: plan.name,
      plan_type: plan.type,
    },
  })

  return NextResponse.json({ url: session.url })
}
