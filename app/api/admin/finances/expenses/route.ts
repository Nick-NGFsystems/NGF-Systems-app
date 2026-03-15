import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface CreateExpenseBody {
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

export async function GET() {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const expenses = await db.expense.findMany({
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: expenses })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load expenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateExpenseBody

    const title = body.title?.trim()
    const amount = Number(body.amount)

    if (!title || Number.isNaN(amount)) {
      return NextResponse.json({ success: false, error: 'Title and amount are required' }, { status: 400 })
    }

    const expense = await db.expense.create({
      data: {
        title,
        amount,
        type: body.type ?? 'ONE_TIME',
        category: body.category ?? 'OTHER',
        paid_date: body.paid_date ? new Date(body.paid_date) : null,
        next_due: body.next_due ? new Date(body.next_due) : null,
        notes: body.notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: expense })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create expense' }, { status: 500 })
  }
}
