import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface UpdateExpenseBody {
  title?: string
  amount?: number
  type?: string
  category?: string
  paid_date?: string | null
  next_due?: string | null
  notes?: string | null
}

async function isAdminRole() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: expenseId } = await context.params

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Expense id is required' }, { status: 400 })
    }

    const body = (await request.json()) as UpdateExpenseBody

    const normalizedTitle = body.title === undefined ? undefined : body.title.trim()
    const normalizedNotes =
      body.notes === undefined ? undefined : body.notes === null ? null : body.notes.trim()

    const expense = await db.expense.update({
      where: { id: expenseId },
      data: {
        title: normalizedTitle,
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        type: body.type,
        category: body.category,
        paid_date: body.paid_date ? new Date(body.paid_date) : body.paid_date === null ? null : undefined,
        next_due: body.next_due ? new Date(body.next_due) : body.next_due === null ? null : undefined,
        notes: normalizedNotes,
      },
    })

    return NextResponse.json({ success: true, data: expense })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update expense' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: expenseId } = await context.params

    if (!expenseId) {
      return NextResponse.json({ success: false, error: 'Expense id is required' }, { status: 400 })
    }

    await db.expense.delete({
      where: { id: expenseId },
    })

    return NextResponse.json({ success: true, data: { id: expenseId } })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete expense' }, { status: 500 })
  }
}
