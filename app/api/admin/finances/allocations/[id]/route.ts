import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

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

    const { id } = await context.params
    const body = await request.json()
    const { name, percentage, notes } = body

    const allocation = await db.budgetAllocation.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(percentage !== undefined && { percentage: parseFloat(percentage) }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, data: allocation })
  } catch (error) {
    console.error('Update allocation error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update allocation' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    await db.budgetAllocation.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete allocation error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete allocation' }, { status: 500 })
  }
}
