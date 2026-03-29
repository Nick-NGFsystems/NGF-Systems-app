import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET() {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const expenses = await db.recurringExpense.findMany({
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: expenses })
  } catch (error) {
    console.error('Get recurring expenses error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch recurring expenses' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, amount, frequency, category, notes } = body

    if (!name || !amount) {
      return NextResponse.json(
        { success: false, error: 'Name and amount are required' },
        { status: 400 }
      )
    }

    const expense = await db.recurringExpense.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        frequency: frequency || 'MONTHLY',
        category: category || 'OTHER',
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Create recurring expense error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create recurring expense' }, { status: 500 })
  }
}
