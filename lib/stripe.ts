import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
})

// ─────────────────────────────────────────────────────────────────────────────
// Plan catalog
//
// Each plan references a real Stripe Price ID created in the NGF Systems
// Stripe account (livemode). If you change pricing, update prices in the
// Stripe dashboard and update the `priceId` here — never change `planKey`.
//
// setupFeePriceId is a one-time Stripe price attached to the *first* invoice
// of a subscription as a second checkout line item. Stripe Checkout combines
// both into a single first-month invoice so the client sees one charge.
// ─────────────────────────────────────────────────────────────────────────────

export const PLANS = {
  // Recurring subscription plans
  starter_monthly: {
    name:             'Starter',
    type:             'monthly' as const,
    priceId:          'price_1TPEhxFIdWU4wW6tvmuk9x3C',
    setupFeePriceId:  'price_1TPEhzFIdWU4wW6tvYP6l739',
    amount:           10000, // cents
    setupFee:         15000, // cents
  },
  professional_monthly: {
    name:             'Professional',
    type:             'monthly' as const,
    priceId:          'price_1TPEi2FIdWU4wW6tdEvgWXHu',
    setupFeePriceId:  'price_1TPEi5FIdWU4wW6tgNZeHie3',
    amount:           25000,
    setupFee:         30000,
  },
  premium_monthly: {
    name:             'Premium',
    type:             'monthly' as const,
    priceId:          'price_1TPEi8FIdWU4wW6t4HHycI1F',
    setupFeePriceId:  'price_1TPEiBFIdWU4wW6t1cZeNz2C',
    amount:           40000,
    setupFee:         60000,
  },
  // One-time builds
  essential_onetime: {
    name:             'Essential',
    type:             'onetime' as const,
    priceId:          'price_1TPEiEFIdWU4wW6tNIdMqZTy',
    setupFeePriceId:  null,
    amount:           79900,
    setupFee:         0,
  },
  business_onetime: {
    name:             'Business',
    type:             'onetime' as const,
    priceId:          'price_1TPEiHFIdWU4wW6tRCU2eEQJ',
    setupFeePriceId:  null,
    amount:           150000,
    setupFee:         0,
  },
} as const

export type PlanKey = keyof typeof PLANS
export type Plan    = (typeof PLANS)[PlanKey]

// ─────────────────────────────────────────────────────────────────────────────
// Plan → ClientConfig feature toggles.
//
// Applied by the Stripe webhook on checkout.session.completed and reverted
// (to the most restrictive set) when a subscription lapses or is cancelled.
//
// Keep this in sync with ClientConfig fields in prisma/schema.prisma.
// ─────────────────────────────────────────────────────────────────────────────

export type PlanFeatures = {
  page_request:     boolean
  page_website:     boolean
  page_content:     boolean
  page_invoices:    boolean
  feature_blog:     boolean
  feature_products: boolean
  feature_booking:  boolean
  feature_gallery:  boolean
}

export const PLAN_FEATURES: Record<PlanKey, PlanFeatures> = {
  starter_monthly: {
    page_request:     true,
    page_website:     true,
    page_content:     true,
    page_invoices:    true,
    feature_blog:     false,
    feature_products: false,
    feature_booking:  false,
    feature_gallery:  false,
  },
  professional_monthly: {
    page_request:     true,
    page_website:     true,
    page_content:     true,
    page_invoices:    true,
    feature_blog:     true,
    feature_products: true,
    feature_booking:  false,
    feature_gallery:  true,
  },
  premium_monthly: {
    page_request:     true,
    page_website:     true,
    page_content:     true,
    page_invoices:    true,
    feature_blog:     true,
    feature_products: true,
    feature_booking:  true,
    feature_gallery:  true,
  },
  // One-time builds do not unlock ongoing portal features by themselves —
  // they produce a deliverable, not a subscription. Admin can flip toggles
  // manually if/when a one-time client is migrated to a managed plan.
  essential_onetime: {
    page_request:     true,
    page_website:     false,
    page_content:     false,
    page_invoices:    true,
    feature_blog:     false,
    feature_products: false,
    feature_booking:  false,
    feature_gallery:  false,
  },
  business_onetime: {
    page_request:     true,
    page_website:     false,
    page_content:     false,
    page_invoices:    true,
    feature_blog:     false,
    feature_products: false,
    feature_booking:  false,
    feature_gallery:  false,
  },
}

// Features applied when a subscription lapses (PAST_DUE, CANCELLED, UNPAID).
// Portal is effectively read-only: only invoices page remains so the client
// can reinstate billing.
export const LAPSED_FEATURES: PlanFeatures = {
  page_request:     true,
  page_website:     false,
  page_content:     false,
  page_invoices:    true,
  feature_blog:     false,
  feature_products: false,
  feature_booking:  false,
  feature_gallery:  false,
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed helpers for Stripe Subscription period fields.
//
// On apiVersion >= 2026-02-25.clover, period timestamps moved to subscription
// items. These helpers resolve the correct field whether the value lives on
// the subscription or the first item, without leaking `any` into callers.
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

// Resolve the app URL from NEXT_PUBLIC_APP_DOMAIN (the one middleware uses),
// falling back to the legacy NEXT_PUBLIC_APP_URL for backwards compat.
export function appUrl(): string {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN
  if (domain) return `https://${domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}`
  return process.env.NEXT_PUBLIC_APP_URL || 'https://app.ngfsystems.com'
}
