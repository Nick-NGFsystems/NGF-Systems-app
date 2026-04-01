import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ClientStatus = 'ACTIVE' | 'LEAD'

interface CreateClientBody {
  name?: string
  email?: string
  phone?: string
  contact_names?: string
  notes?: string
  status?: ClientStatus
  send_setup_email?: boolean
}

export async function POST(request: Request) {
  let createdClerkUserId: string | null = null
  let createdInvitationId: string | null = null
  let resultMessage = 'Client created'

  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateClientBody
    const name = body.name?.trim() || null
    const email = body.email?.trim().toLowerCase() || null
    const phone = body.phone?.trim() || null
    const contactNames = body.contact_names?.trim() || null
    const notes = body.notes?.trim() || null
    const status: ClientStatus = body.status ?? 'ACTIVE'
    const sendSetupEmail = body.send_setup_email === true
    const signUpRedirectUrl = new URL('/sign-up', request.url).toString()

    if (!['ACTIVE', 'LEAD'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }

    if (email && !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 })
    }

    if (sendSetupEmail && !email) {
      return NextResponse.json(
        { success: false, error: 'Email is required to send a setup email' },
        { status: 400 }
      )
    }

    if (email) {
      const existing = await db.client.findFirst({ where: { email }, select: { id: true } })
      if (existing) {
        return NextResponse.json({ success: false, error: 'A client with this email already exists' }, { status: 400 })
      }

      try {
        const clerk = await clerkClient()
        let existingClerkUserId: string | null = null

        const existingUsers = await clerk.users.getUserList({
          emailAddress: [email],
          limit: 1,
        })

        if (existingUsers.data.length > 0) {
          const existingUser = existingUsers.data[0]
          const existingRole = (existingUser.publicMetadata as { role?: string } | undefined)?.role

          if (existingRole && existingRole !== 'client') {
            return NextResponse.json(
              {
                success: false,
                error: 'This email is already used by a non-client Clerk account',
              },
              { status: 400 }
            )
          }

          existingClerkUserId = existingUser.id
          await clerk.users.updateUserMetadata(existingClerkUserId, {
            publicMetadata: { role: 'client' },
          })
        }

        if (sendSetupEmail) {
          // Send an application invitation only when explicitly requested by admin.
          // The client creates their password through Clerk's invite flow.
          if (existingClerkUserId) {
            createdClerkUserId = existingClerkUserId
            resultMessage = 'Client created and linked to existing Clerk user'
          } else {
            try {
              const invitation = await clerk.invitations.createInvitation({
                emailAddress: email,
                publicMetadata: { role: 'client' },
                notify: true,
                redirectUrl: signUpRedirectUrl,
                templateSlug: 'invitation',
              })
              createdInvitationId = invitation.id
              resultMessage = 'Client created and setup email sent'
            } catch (error: unknown) {
              const maybeError = error as { errors?: Array<{ message?: string }> }
              const detail = maybeError.errors?.[0]?.message?.toLowerCase() ?? ''

              if (detail.includes('duplicate invitation')) {
                resultMessage = 'Client created. A setup invitation is already pending for this email.'
              } else {
                throw error
              }
            }
          }
        } else {
          // Create the Clerk user without sending any setup email.
          // Admin can choose to notify the client later.
          if (existingClerkUserId) {
            createdClerkUserId = existingClerkUserId
            resultMessage = 'Client created and linked to existing Clerk user'
          } else {
            const createdUser = await clerk.users.createUser({
              emailAddress: [email],
              publicMetadata: { role: 'client' },
            })
            createdClerkUserId = createdUser.id
            resultMessage = 'Client created and Clerk account linked'
          }
        }
      } catch (error: unknown) {
        const maybeError = error as { errors?: Array<{ message?: string }> }
        const detail = maybeError.errors?.[0]?.message
        return NextResponse.json(
          {
            success: false,
            error: detail ?? 'Unable to create Clerk account for this client',
          },
          { status: 400 }
        )
      }
    }

    const client = await db.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
        data: {
          name,
          email,
          clerk_user_id: createdClerkUserId,
          phone,
          contact_names: contactNames,
          notes,
          status,
        },
      })

      // Future self-signup flow hook: self-registered clients will create a LEAD client
      // and a restricted client_config (for example, only page_request enabled).
      await tx.clientConfig.create({
        data: {
          client_id: createdClient.id,
        },
      })

      return createdClient
    })

    return NextResponse.json({ success: true, data: client, message: resultMessage })
  } catch (error: unknown) {
    if (createdInvitationId) {
      try {
        const clerk = await clerkClient()
        await clerk.invitations.revokeInvitation(createdInvitationId)
      } catch {
        // Ignore cleanup failures so we can still return the root API error.
      }
    }

    if (createdClerkUserId) {
      try {
        const clerk = await clerkClient()
        await clerk.users.deleteUser(createdClerkUserId)
      } catch {
        // Ignore cleanup failures so we can still return the root API error.
      }
    }

    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 })
  }
}
