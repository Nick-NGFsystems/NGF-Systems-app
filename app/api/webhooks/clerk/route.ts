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

interface ClerkUserDeletedEvent {
  type: 'user.deleted'
  data: { id: string; deleted: true }
}

interface ClerkGenericEvent {
  type: string
  data?: unknown
}

type ClerkWebhookEvent = ClerkUserCreatedEvent | ClerkUserDeletedEvent | ClerkGenericEvent

function isClerkWebhookEvent(value: unknown): value is ClerkWebhookEvent {
  if (typeof value !== 'object' || value === null) return false

  const maybeEvent = value as { type?: unknown }
  return typeof maybeEvent.type === 'string'
}

function isUserDeletedEvent(event: ClerkWebhookEvent): event is ClerkUserDeletedEvent {
  return event.type === 'user.deleted'
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
      const primaryEmail = verifiedPayload.data.email_addresses[0]?.email_address

      // Only set role to 'client' if the user doesn't already have a role.
      // This prevents overriding an admin account that was manually given 'admin'.
      const existingRole = (verifiedPayload.data as Record<string, unknown>)?.public_metadata
        ? ((verifiedPayload.data as Record<string, unknown>).public_metadata as Record<string, unknown>)?.role
        : undefined

      if (!existingRole) {
        await clerk.users.updateUserMetadata(verifiedPayload.data.id, {
          publicMetadata: { role: 'client' },
        })
      }

      if (primaryEmail) {
        // Try to link to an existing client row created by admin
        const existing = await db.client.findUnique({ where: { email: primaryEmail } })

        if (existing) {
          // Link the Clerk user ID if not already linked
          if (!existing.clerk_user_id) {
            await db.client.update({
              where: { id: existing.id },
              data: { clerk_user_id: verifiedPayload.data.id },
            })
          }
        } else {
          // Self-signup: create a new client row + config with only page_request enabled
          const newClient = await db.client.create({
            data: {
              email: primaryEmail,
              name: primaryEmail.split('@')[0],
              status: 'LEAD',
              clerk_user_id: verifiedPayload.data.id,
            },
          })
          await db.clientConfig.create({
            data: {
              client_id: newClient.id,
              page_request: true,
              page_website: false,
              page_content: false,
              page_invoices: false,
              feature_blog: false,
              feature_products: false,
              feature_booking: false,
              feature_gallery: false,
            },
          })
        }
      }
    } else if (isUserDeletedEvent(verifiedPayload)) {
      // Unlink Clerk account without deleting client record (preserves financial data)
      await db.client.updateMany({
        where: { clerk_user_id: verifiedPayload.data.id },
        data: { clerk_user_id: null },
      })
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