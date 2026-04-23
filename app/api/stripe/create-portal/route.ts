import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { stripe, appUrl } from '@/lib/stripe'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { returnUrl } = await req.json().catch(() => ({}))
    const base = appUrl()

    const client = await db.client.findFirst({
      where: { clerk_user_id: userId },
    })

    if (!client?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No billing account found. Please set up a subscription first.' },
        { status: 404 }
      )
    }

    const session = await stripe.billingPortal.sessions.create({
      customer:   client.stripe_customer_id,
      return_url: returnUrl ?? `${base}/portal/portal-dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('[stripe create-portal]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
