import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getClientDb } from '@/lib/client-db'
import crypto from 'crypto'

// GET — fetch all service requests from client's external database
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await params

    // Get client's database URL from NGF app database
    const config = await db.clientConfig.findUnique({
      where: { client_id: clientId },
    })

    if (!config?.database_url) {
      return NextResponse.json(
        { success: false, error: 'No database URL configured for this client' },
        { status: 400 }
      )
    }

    // Connect to client's external database
    const clientDb = getClientDb(config.database_url)

    const requests = await (clientDb as any).serviceRequest.findMany({
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('Service requests GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch service requests' },
      { status: 500 }
    )
  }
}

// PATCH — update a service request status (approve/decline/followup)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string })?.role
    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await params
    const body = await req.json()
    const { requestId, status, notes, jobDuration } = body

    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, error: 'requestId and status are required' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'approved', 'declined', 'followup']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Get client config
    const config = await db.clientConfig.findUnique({
      where: { client_id: clientId },
    })

    if (!config?.database_url) {
      return NextResponse.json(
        { success: false, error: 'No database URL configured for this client' },
        { status: 400 }
      )
    }

    const clientDb = getClientDb(config.database_url)

    // Build update data
    const updateData: Record<string, unknown> = { status, updatedAt: new Date() }

    // If approving, generate a booking token
    if (status === 'approved') {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenExpires = new Date(Date.now() + 48 * 60 * 60 * 1000) // 48 hours
      updateData.bookingToken = token
      updateData.tokenExpires = tokenExpires
    }

    if (notes !== undefined) {
      updateData.notes = notes
    }

    if (typeof jobDuration === 'number' && jobDuration > 0) {
      updateData.jobDuration = jobDuration
    }

    const updated = await (clientDb as any).serviceRequest.update({
      where: { id: requestId },
      data: updateData,
    })

    // If approved, send booking email via Resend
    if (status === 'approved' && config.booking_url && updated.bookingToken) {
      const bookingLink = config.booking_url.replace('[token]', updated.bookingToken)
      
      // Get client name for email context
      const client = await db.client.findUnique({
        where: { id: clientId },
        select: { name: true },
      })

      // Send email via Resend
      const { Resend } = await import('resend')
      const resend = new Resend(process.env.RESEND_API_KEY)
      
      await resend.emails.send({
        from: 'NGFsystems <noreply@ngfsystems.com>',
        to: updated.email,
        subject: `Your service request has been approved — ${client?.name ?? 'Service Shop'}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Your request has been approved!</h2>
            <p>Hi ${updated.name},</p>
            <p>Great news — your service request for your ${updated.bikeYear} ${updated.bikeMake} ${updated.bikeModel} has been approved.</p>
            <p><strong>Service:</strong> ${updated.service}</p>
            ${updated.jobDuration ? `<p><strong>Estimated duration:</strong> ${updated.jobDuration} ${updated.jobDuration === 1 ? 'day' : 'days'}</p>` : ''}
            ${notes ? `<p><strong>Notes from shop:</strong> ${notes}</p>` : ''}
            <p>Click the link below to complete your booking:</p>
            <a href="${bookingLink}" style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin: 16px 0;">
              Complete Booking
            </a>
            <p style="color: #6b7280; font-size: 14px;">This link expires in 48 hours.</p>
          </div>
        `,
      })
    }

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Service requests PATCH error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update service request' },
      { status: 500 }
    )
  }
}
