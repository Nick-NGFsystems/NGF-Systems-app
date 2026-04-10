import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2026-02-25.clover',
})

// Plan definitions — keep in sync with your Stripe Dashboard products
export const PLANS = {
  // Monthly managed plans (Stripe recurring prices)
  starter_monthly: {
    name: 'Starter',
    type: 'monthly' as const,
    amount: 10000, // $100/mo in cents
    setupFee: 15000, // $150 setup in cents
  },
  professional_monthly: {
    name: 'Professional',
    type: 'monthly' as const,
    amount: 25000, // $250/mo in cents
    setupFee: 30000, // $300 setup in cents
  },
  premium_monthly: {
    name: 'Premium',
    type: 'monthly' as const,
    amount: 40000, // $400/mo in cents
    setupFee: 60000, // $600 setup in cents
  },
  // One-time builds (Stripe one-time prices)
  essential_onetime: {
    name: 'Essential',
    type: 'onetime' as const,
    amount: 79900, // $799 in cents
    setupFee: 0,
  },
  business_onetime: {
    name: 'Business',
    type: 'onetime' as const,
    amount: 150000, // $1,500 in cents
    setupFee: 0,
  },
} as const

export type PlanKey = keyof typeof PLANS
