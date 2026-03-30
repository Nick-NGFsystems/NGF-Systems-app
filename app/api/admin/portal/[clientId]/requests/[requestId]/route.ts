import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    clientId: string
    requestId: string
  }>
}

interface RequestUpdatePayload {
  status?: string
  admin_comment?: string | null
}

const validStatus = new Set(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'])

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, requestId } = await context.params

    const existing = await db.changeRequest.findUnique({ where: { id: requestId } })
    if (!existing || existing.client_id !== clientId) {
      return NextResponse.json({ success: false, error: 'Change request not found' }, { status: 404 })
    }

    const body = (await request.json()) as RequestUpdatePayload

    if (body.status && !validStatus.has(body.status)) {
      return NextResponse.json({ success: false, error: 'Invalid status' }, { status: 400 })
    }

    const updated = await db.changeRequest.update({
      where: { id: requestId },
      data: {
        ...(body.status !== undefined && { status: body.status }),
        ...(body.admin_comment !== undefined && { admin_comment: body.admin_comment?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update change request error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update change request' }, { status: 500 })
  }
}
