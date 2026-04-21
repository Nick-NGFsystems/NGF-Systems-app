import crypto from 'crypto'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface CreateClerkAccountBody {
  send_setup_email?: boolean
}

function splitClientName(name?: string | null) {
  const trimmed = name?.trim()

  if (!trimmed) {
    return { firstName: undefined, lastName: undefined }
  }

  const [firstName, ...rest] = trimmed.split(/\s+/)

  return {
    firstName,
    lastName: rest.length > 0 ? rest.join(' ') : undefined,
  }
}

function generateTemporaryPassword() {
  return `${crypto.randomBytes(12).toString('base64url')}Aa1!`
}

async function sendSetupEmail(args: {
  to: string
  customerName?: string | null
  businessName?: string | null
  signInUrl: string
  temporaryPassword?: string | null
}) {
  const resendApiKey = process.env.RESEND_API_KEY

  if (!resendApiKey || resendApiKey === 'your_resend_api_key_here') {
    throw new Error('RESEND_API_KEY is not configured')
  }

  const { Resend } = await import('resend')
  const resend = new Resend(resendApiKey)

  const greetingName = args.customerName?.trim() || 'there'
  const businessName = args.businessName?.trim() || 'NGFsystems'

  await resend.emails.send({
    from: 'NGFsystems <noreply@ngfsystems.com>',
    to: args.to,
    subject: `${businessName} client portal access is ready`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Your client portal is ready</h2>
        <p>Hi ${greetingName},</p>
        <p>Your portal account for ${businessName} has been set up.</p>
        ${args.temporaryPassword ? `<p><strong>Temporary password:</strong> ${args.temporaryPassword}</p>` : ''}
        <p>You can sign in here:</p>
        <p>
          <a href="${args.signInUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none;">
            Sign in to the portal
          </a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">Please change your password after signing in.</p>
      </div>
    `,
  })
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: clientId } = await context.params

    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Client id is required' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as CreateClerkAccountBody
    const sendSetupEmailChoice = body.send_setup_email === true

    const client = await db.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        email: true,
        clerk_user_id: true,
      },
    })

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    if (!client.email) {
      return NextResponse.json(
        { success: false, error: 'Client must have an email address before creating a Clerk account' },
        { status: 400 }
      )
    }

    const clerk = await clerkClient()
    const { firstName, lastName } = splitClientName(client.name)
    const signInUrl = new URL('/sign-in', request.url).toString()

    if (client.clerk_user_id) {
      return NextResponse.json(
        { success: false, error: 'This client already has a linked Clerk account' },
        { status: 400 }
      )
    }

    const existingUsers = await clerk.users.getUserList({
      emailAddress: [client.email],
      limit: 10,
    })

    const existingUser = existingUsers.data.find(
      (user) => user.emailAddresses.some((item) => item.emailAddress.toLowerCase() === client.email?.toLowerCase())
    )

    if (existingUser) {
      const existingRole = (existingUser.publicMetadata as { role?: string } | undefined)?.role

      if (existingRole && existingRole !== 'client') {
        return NextResponse.json(
          { success: false, error: 'This email is already used by a non-client Clerk account' },
          { status: 409 }
        )
      }

      await clerk.users.updateUserMetadata(existingUser.id, {
        publicMetadata: { role: 'client' },
      })

      if (firstName || lastName) {
        await clerk.users.updateUser(existingUser.id, {
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        })
      }

      await db.client.update({
        where: { id: client.id },
        data: { clerk_user_id: existingUser.id },
      })

      if (sendSetupEmailChoice) {
        try {
          await sendSetupEmail({
            to: client.email,
            customerName: client.name,
            businessName: client.name,
            signInUrl,
            temporaryPassword: null,
          })

          return NextResponse.json({
            success: true,
            data: { clerk_user_id: existingUser.id },
            message: 'Existing Clerk account linked and setup email sent',
          })
        } catch {
          return NextResponse.json({
            success: true,
            data: { clerk_user_id: existingUser.id },
            message: 'Existing Clerk account linked, but setup email could not be sent',
          })
        }
      }

      return NextResponse.json({
        success: true,
        data: { clerk_user_id: existingUser.id },
        message: 'Existing Clerk account linked to this client',
      })
    }

    const temporaryPassword = generateTemporaryPassword()

    const createdUser = await clerk.users.createUser({
      emailAddress: [client.email],
      password: temporaryPassword,
      publicMetadata: { role: 'client' },
      ...(firstName ? { firstName } : {}),
      ...(lastName ? { lastName } : {}),
    })

    await db.client.update({
      where: { id: client.id },
      data: { clerk_user_id: createdUser.id },
    })

    if (sendSetupEmailChoice) {
      try {
        await sendSetupEmail({
          to: client.email,
          customerName: client.name,
          businessName: client.name,
          signInUrl,
          temporaryPassword,
        })

        return NextResponse.json({
          success: true,
          data: { clerk_user_id: createdUser.id },
          message: 'Clerk account created and setup email sent',
        })
      } catch {
        return NextResponse.json({
          success: true,
          data: { clerk_user_id: createdUser.id },
          message: 'Clerk account created, but setup email could not be sent',
          temporaryPassword,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: { clerk_user_id: createdUser.id },
      message: 'Clerk account created',
      temporaryPassword,
    })
  } catch (error) {
    console.error('Create Clerk account error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create Clerk account' },
      { status: 500 }
    )
  }
}
