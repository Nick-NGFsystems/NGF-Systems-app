import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { db } from '@/lib/db'

interface ClerkEmailAddress {
  email_address: string
  id: string
}

interface ClerkUserCreatedEvent {
  type: 'user.created'
  data: {
    id: string
    email_addresses: ClerkEmailAddress[]
  }
}

interface ClerkGenericEvent {
  type: string
  data?: unknown
}

type ClerkWebhookEvent = ClerkUserCreatedEvent | ClerkGenericEvent

function isClerkWebhookEvent(value: unknown): value is ClerkWebhookEvent {
  if (typeof value !== 'object' || value === null) return false

  const maybeEvent = value as { type?: unknown }
  return typeof maybeEvent.type === 'string'
}

function isUserCreatedEvent(event: ClerkWebhookEvent): event is ClerkUserCreatedEvent {
  if (event.type !== 'user.created') return false
  if (typeof event.data !== 'object' || event.data === null) return false

  const data = event.data as { id?: unknown; email_addresses?: unknown }
  return typeof data.id === 'string' && Array.isArray(data.email_addresses)
}

export async function POST(req: Request): Promise<Response> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json(
      { success: false, error: 'Missing CLERK_WEBHOOK_SECRET' },
      { status: 500 }
    )
  }

  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { success: false, error: 'Missing Svix headers' },
      { status: 400 }
    )
  }

  const payload = await req.text()

  let verifiedPayload: unknown

  try {
    const webhook = new Webhook(webhookSecret)
    verifiedPayload = webhook.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (error) {
    console.error('Invalid Clerk webhook signature:', error)
    return NextResponse.json(
      { success: false, error: 'Invalid webhook signature' },
      { status: 400 }
    )
  }

  if (!isClerkWebhookEvent(verifiedPayload)) {
    return NextResponse.json(
      { success: false, error: 'Invalid webhook payload' },
      { status: 400 }
    )
  }

  try {
    if (isUserCreatedEvent(verifiedPayload)) {
      const clerk = await clerkClient()

      // Set role to 'client' for all new sign-ups
      await clerk.users.updateUserMetadata(verifiedPayload.data.id, {
        publicMetadata: { role: 'client' },
      })

      // Link the new Clerk user to an existing client record by email
      const primaryEmail = verifiedPayload.data.email_addresses[0]?.email_address
      if (primaryEmail) {
        await db.client.updateMany({
          where: {
            email: primaryEmail,
            clerk_user_id: null,
          },
          data: { clerk_user_id: verifiedPayload.data.id },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Clerk webhook processing error:', error)
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}