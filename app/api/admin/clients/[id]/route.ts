import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CLIENT_STATUSES } from '@/lib/client-status'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface UpdateClientBody {
  name?: string
  email?: string
  phone?: string
  contact_names?: string
  notes?: string
  status?: string
}

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

  return role === 'admin'
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await context.params

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Client id is required' }, { status: 400 })
    }

    const existingClient = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, clerk_user_id: true },
    })

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    const clerk = await clerkClient()

    if (existingClient.clerk_user_id) {
      try {
        const linkedUser = await clerk.users.getUser(existingClient.clerk_user_id)
        const linkedRole = (linkedUser.publicMetadata as { role?: string } | undefined)?.role

        if (linkedRole && linkedRole !== 'client') {
          return NextResponse.json(
            { success: false, error: 'Linked Clerk user is not a client account' },
            { status: 409 }
          )
        }

        await clerk.users.deleteUser(existingClient.clerk_user_id)
      } catch {
        return NextResponse.json(
          { success: false, error: 'Failed to delete linked Clerk user' },
          { status: 502 }
        )
      }
    }

    if (existingClient.email) {
      try {
        if (!existingClient.clerk_user_id) {
          const users = await clerk.users.getUserList({
            emailAddress: [existingClient.email],
            limit: 1,
          })

          if (users.data.length > 0) {
            const user = users.data[0]
            const userRole = (user.publicMetadata as { role?: string } | undefined)?.role

            if (!userRole || userRole === 'client') {
              await clerk.users.deleteUser(user.id)
            } else {
              return NextResponse.json(
                { success: false, error: 'Email is linked to a non-client Clerk account' },
                { status: 409 }
              )
            }
          }
        }

        const invitations = await clerk.invitations.getInvitationList({
          query: existingClient.email,
          status: 'pending',
          limit: 100,
        })

        const matchingInvites = invitations.data.filter(
          (item) => item.emailAddress.toLowerCase() === existingClient.email?.toLowerCase()
        )

        await Promise.all(
          matchingInvites.map((invite) => clerk.invitations.revokeInvitation(invite.id))
        )
      } catch {
        return NextResponse.json(
          { success: false, error: 'Failed to revoke pending Clerk invitations' },
          { status: 502 }
        )
      }
    }

    await db.client.delete({
      where: { id: clientId },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete client' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await context.params

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Client id is required' }, { status: 400 })
    }

    const body = (await request.json()) as UpdateClientBody
    const hasName = Object.prototype.hasOwnProperty.call(body, 'name')
    const hasEmail = Object.prototype.hasOwnProperty.call(body, 'email')
    const hasPhone = Object.prototype.hasOwnProperty.call(body, 'phone')
    const hasContactNames = Object.prototype.hasOwnProperty.call(body, 'contact_names')
    const hasNotes = Object.prototype.hasOwnProperty.call(body, 'notes')
    const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')

    const name = body.name?.trim() || null
    const email = body.email?.trim().toLowerCase() || null
    const phone = body.phone?.trim() || null
    const contactNames = body.contact_names?.trim() || null
    const notes = body.notes?.trim() || null
    const status = body.status?.trim().toUpperCase()

    if (!hasName && !hasEmail && !hasPhone && !hasContactNames && !hasNotes && !hasStatus) {
      return NextResponse.json({ success: false, error: 'At least one field is required' }, { status: 400 })
    }

    if (hasStatus && status && !CLIENT_STATUSES.includes(status as (typeof CLIENT_STATUSES)[number])) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }

    if (email && !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 })
    }

    const existingClient = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, clerk_user_id: true },
    })

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    if (hasEmail && email) {
      const emailTaken = await db.client.findFirst({
        where: { email, NOT: { id: clientId } },
        select: { id: true },
      })
      if (emailTaken) {
        return NextResponse.json({ success: false, error: 'Email already in use' }, { status: 400 })
      }
    }

    const data: {
      name?: string | null
      email?: string | null
      phone?: string | null
      contact_names?: string | null
      notes?: string | null
      status?: string
      clerk_user_id?: string | null
    } = {}

    if (hasEmail && email !== existingClient.email) {
      const clerk = await clerkClient()

      if (existingClient.clerk_user_id) {
        return NextResponse.json(
          {
            success: false,
            error: 'Cannot change email for a linked Clerk account from this screen',
          },
          { status: 400 }
        )
      }

      if (email) {
        const users = await clerk.users.getUserList({
          emailAddress: [email],
          limit: 1,
        })

        if (users.data.length > 0) {
          const user = users.data[0]
          const role = (user.publicMetadata as { role?: string } | undefined)?.role

          if (role && role !== 'client') {
            return NextResponse.json(
              {
                success: false,
                error: 'This email is already used by a non-client Clerk account',
              },
              { status: 400 }
            )
          }

          await clerk.users.updateUserMetadata(user.id, {
            publicMetadata: { role: 'client' },
          })
          data.clerk_user_id = user.id
        } else {
          data.clerk_user_id = null
        }
      } else {
        data.clerk_user_id = null
      }
    }

    if (hasName) data.name = name
    if (hasEmail) data.email = email
    if (hasPhone) data.phone = phone
    if (hasContactNames) data.contact_names = contactNames
    if (hasNotes) data.notes = notes
    if (hasStatus && status) data.status = status

    const updatedClient = await db.client.update({
      where: { id: clientId },
      data,
    })

    return NextResponse.json({ success: true, data: updatedClient })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update client' }, { status: 500 })
  }
}
