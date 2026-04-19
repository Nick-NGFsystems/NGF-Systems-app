import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{ id: string }>
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

    const { id } = await context.params

    const existing = await db.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Time entry not found' }, { status: 404 })
    }

    await db.timeEntry.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete time entry error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete time entry' }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const existing = await db.timeEntry.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Time entry not found' }, { status: 404 })
    }

    const body = await request.json() as {
      client_id?: string
      project_id?: string | null
      hours?: number
      notes?: string | null
    }

    const updateData: {
      client_id?: string
      project_id?: string | null
      hours?: number
      notes?: string | null
    } = {}

    if (body.client_id !== undefined) updateData.client_id = body.client_id
    if (body.project_id !== undefined) updateData.project_id = body.project_id || null
    if (body.notes !== undefined) updateData.notes = body.notes?.trim() || null

    if (body.hours !== undefined) {
      const hours = parseFloat(String(body.hours))
      if (!Number.isFinite(hours) || hours <= 0) {
        return NextResponse.json({ success: false, error: 'Hours must be a positive number' }, { status: 400 })
      }
      updateData.hours = hours
    }

    const updated = await db.timeEntry.update({ where: { id }, data: updateData })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update time entry error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update time entry' }, { status: 500 })
  }
}
