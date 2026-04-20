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
    const { name, amount, frequency, category, startDate, endDate, notes } = body

    if (!name || !amount) {
      return NextResponse.json(
        { success: false, error: 'Name and amount are required' },
        { status: 400 }
      )
    }

    const parsedStartDate = startDate ? new Date(startDate) : new Date()
    const parsedEndDate = endDate ? new Date(endDate) : null

    if (!Number.isFinite(parsedStartDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Start date is invalid' }, { status: 400 })
    }

    if (parsedEndDate && !Number.isFinite(parsedEndDate.getTime())) {
      return NextResponse.json({ success: false, error: 'End date is invalid' }, { status: 400 })
    }

    if (parsedEndDate && parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { success: false, error: 'End date must be after start date' },
        { status: 400 }
      )
    }

    const expense = await db.recurringExpense.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        frequency: frequency || 'MONTHLY',
        category: category || 'OTHER',
        start_date: parsedStartDate,
        end_date: parsedEndDate,
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: expense })
  } catch (error) {
    console.error('Create recurring expense error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create recurring expense' }, { status: 500 })
  }
}
