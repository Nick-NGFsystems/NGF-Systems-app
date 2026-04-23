import Stripe from 'stripe'
import { db } from '@/lib/db'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
})

// ─────────────────────────────────────────────────────────────────────────────
// Optional preset plans
//
// NGFsystems negotiates pricing per client, so these are reference values that
// admin can optionally use as starting points when creating a subscription —
// not enforced tiers. The admin billing UI can offer these as quick-fill
// suggestions but accepts any custom amount.
// ─────────────────────────────────────────────────────────────────────────────

export const PLAN_PRESETS = {
  starter_monthly:       { name: 'Starter',      amount: 10000,  interval: 'month' as const },
  professional_monthly:  { name: 'Professional', amount: 25000,  interval: 'month' as const },
  premium_monthly:       { name: 'Premium',      amount: 40000,  interval: 'month' as const },
} as const

export type PlanPresetKey = keyof typeof PLAN_PRESETS

// Pre-created Stripe products (live mode) if you want to reference them
// when creating subscriptions. Keep in sync with your Stripe dashboard.
export const STRIPE_PRODUCTS = {
  starter:       'prod_UO0jP4rvvyWyij',
  professional:  'prod_UO0jYZ9O0yz0W7',
  premium:       'prod_UO0j76kI1phIWu',
  essential:     'prod_UO0j7E1AhxYs7P',
  business:      'prod_UO0jpPBalKmBMb',
  managed:       'prod_UO0jP4rvvyWyij', // alias — default product for custom subs
} as const

// ─────────────────────────────────────────────────────────────────────────────
// Typed helpers for Stripe Subscription period fields.
//
// On apiVersion >= 2026-02-25.clover, period timestamps moved to subscription
// items. These helpers resolve the correct field whether the value lives on
// the subscription or the first item.
// ─────────────────────────────────────────────────────────────────────────────

type SubscriptionPeriodShape = {
  current_period_start?: number
  current_period_end?:   number
  items?: { data: Array<{ current_period_start?: number; current_period_end?: number }> }
}

export function subscriptionPeriod(sub: Stripe.Subscription): { start: Date | null; end: Date | null } {
  const s = sub as unknown as SubscriptionPeriodShape
  const startEpoch = s.current_period_start ?? s.items?.data?.[0]?.current_period_start
  const endEpoch   = s.current_period_end   ?? s.items?.data?.[0]?.current_period_end
  return {
    start: typeof startEpoch === 'number' ? new Date(startEpoch * 1000) : null,
    end:   typeof endEpoch   === 'number' ? new Date(endEpoch   * 1000) : null,
  }
}

// Resolve the app URL from NEXT_PUBLIC_APP_DOMAIN, falling back to legacy var.
export function appUrl(): string {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN
  if (domain) return `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.ngfsystems.com'
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer helpers
// ─────────────────────────────────────────────────────────────────────────────

export type ClientForStripe = {
  id:                 string
  email:              string | null
  name:               string | null
  business:           string | null
  clerk_user_id:      string | null
  stripe_customer_id: string | null
}

/**
 * Ensures the client has a Stripe Customer record, creating one if needed.
 * Returns the Stripe customer ID. Persists it to the client row if new.
 */
export async function getOrCreateStripeCustomer(client: ClientForStripe): Promise<string> {
  if (client.stripe_customer_id) return client.stripe_customer_id

  const customer = await stripe.customers.create({
    email:    client.email ?? undefined,
    name:     client.name ?? client.business ?? undefined,
    metadata: {
      client_id:     client.id,
      clerk_user_id: client.clerk_user_id ?? '',
    },
  })

  await db.client.update({
    where: { id: client.id },
    data:  { stripe_customer_id: customer.id },
  })

  return customer.id
}

// ─────────────────────────────────────────────────────────────────────────────
// Subscription creation
//
// Collection is `send_invoice` with a 7-day due window — Stripe emails an
// invoice each cycle, the client pays via the hosted invoice link. No card
// on file is required; clients can optionally save a payment method via the
// Stripe Customer Portal to switch to auto-pay afterward.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateSubscriptionInput {
  clientId:     string
  amountCents:  number
  interval:     'month' | 'year'
  description?: string
  /** Optional preset key if the admin chose one. Stored in metadata/plan_key. */
  presetKey?:   string
}

export async function createSubscriptionForClient(input: CreateSubscriptionInput): Promise<Stripe.Subscription> {
  const { clientId, amountCents, interval, description, presetKey } = input

  if (amountCents < 50) {
    throw new Error('Minimum subscription amount is $0.50 (50 cents)')
  }

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')

  const customerId = await getOrCreateStripeCustomer(client)

  // Create a fresh Price tied to the default "managed" product so the Stripe
  // dashboard stays navigable: each price is still listed under NGF Starter
  // Plan even if its amount is custom.
  const price = await stripe.prices.create({
    currency:     'usd',
    product:      STRIPE_PRODUCTS.managed,
    unit_amount:  amountCents,
    recurring:    { interval },
    nickname:     description ?? `${client.business ?? client.name ?? 'Client'} — $${(amountCents / 100).toFixed(2)}/${interval}`,
    metadata:     { client_id: clientId },
  })

  const sub = await stripe.subscriptions.create({
    customer:           customerId,
    items:              [{ price: price.id }],
    collection_method:  'send_invoice',
    days_until_due:     7,
    description:        description,
    metadata: {
      client_id:  clientId,
      plan_key:   presetKey ?? 'custom',
      plan_name:  description ?? 'Managed Website',
    },
  })

  return sub
}

// ─────────────────────────────────────────────────────────────────────────────
// One-time invoice creation
//
// For setup fees, add-on work, ad-hoc charges. Creates an InvoiceItem + Invoice
// in `send_invoice` mode, finalizes it, and sends the email. Client receives a
// payable invoice link via email.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateOneTimeInvoiceInput {
  clientId:    string
  amountCents: number
  description: string
}

export async function createOneTimeInvoice(input: CreateOneTimeInvoiceInput): Promise<Stripe.Invoice> {
  const { clientId, amountCents, description } = input

  if (amountCents < 50) throw new Error('Minimum invoice amount is $0.50 (50 cents)')
  if (!description.trim()) throw new Error('Description is required for one-time invoices')

  const client = await db.client.findUnique({ where: { id: clientId } })
  if (!client) throw new Error('Client not found')

  const customerId = await getOrCreateStripeCustomer(client)

  // Create the Invoice first so the InvoiceItem attaches to it directly
  // (as opposed to pending). We use the old `pending` behavior for safety.
  const invoiceItem = await stripe.invoiceItems.create({
    customer:    customerId,
    amount:      amountCents,
    currency:    'usd',
    description,
  })

  const invoice = await stripe.invoices.create({
    customer:                        customerId,
    collection_method:               'send_invoice',
    days_until_due:                  7,
    description,
    pending_invoice_items_behavior:  'include',
    metadata: { client_id: clientId, invoice_item: invoiceItem.id },
  })

  if (!invoice.id) throw new Error('Stripe invoice creation did not return an id')

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
  if (!finalized.id) throw new Error('Finalized invoice missing id')

  const sent = await stripe.invoices.sendInvoice(finalized.id)
  return sent
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancel helpers
// ─────────────────────────────────────────────────────────────────────────────

export async function cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true })
}

export async function resumeSubscription(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false })
}

export async function cancelSubscriptionImmediately(stripeSubscriptionId: string): Promise<Stripe.Subscription> {
  return stripe.subscriptions.cancel(stripeSubscriptionId)
}
