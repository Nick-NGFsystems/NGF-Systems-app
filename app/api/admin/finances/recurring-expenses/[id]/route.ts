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
    const { name, amount, frequency, category, startDate, endDate, notes } = body

    const parsedStartDate = startDate !== undefined ? new Date(startDate) : undefined
    const parsedEndDate = endDate !== undefined ? (endDate ? new Date(endDate) : null) : undefined

    if (parsedStartDate !== undefined && !Number.isFinite(parsedStartDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Start date is invalid' }, { status: 400 })
    }

    if (parsedEndDate !== undefined && parsedEndDate !== null && !Number.isFinite(parsedEndDate.getTime())) {
      return NextResponse.json({ success: false, error: 'End date is invalid' }, { status: 400 })
    }

    if (parsedStartDate !== undefined && parsedEndDate !== undefined && parsedEndDate !== null && parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    const expense = await db.recurringExpense.update({
      where: { id },
      data: {
        ...(name && { name: name.trim() }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(frequency && { frequency }),
        ...(category && { category }),
        ...(parsedStartDate !== undefined && { start_date: parsedStartDate }),
        ...(parsedEndDate !== undefined && { end_date: parsedEndDate }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Update recurring expense error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update recurring expense' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    await db.recurringExpense.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete recurring expense error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete recurring expense' }, { status: 500 })
  }
}
