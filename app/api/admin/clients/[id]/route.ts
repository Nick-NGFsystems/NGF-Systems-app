import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { CLIENT_STATUSES } from '@/lib/client-status'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface UpdateClientBody {
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
      select: { id: true },
    })

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
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
    const status = body.status?.trim().toUpperCase()

    if (!status) {
      return NextResponse.json({ success: false, error: 'Status is required' }, { status: 400 })
    }

    if (!CLIENT_STATUSES.includes(status as (typeof CLIENT_STATUSES)[number])) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }

    const existingClient = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })

    if (!existingClient) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    const updatedClient = await db.client.update({
      where: { id: clientId },
      data: { status },
    })

    return NextResponse.json({ success: true, data: updatedClient })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update status' }, { status: 500 })
  }
}
