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

    const income = await db.recurringIncome.findMany({
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: income })
  } catch (error) {
    console.error('Get recurring income error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch recurring income' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, amount, frequency, notes } = body

    if (!name || !amount) {
      return NextResponse.json(
        { success: false, error: 'Name and amount are required' },
        { status: 400 }
      )
    }

    const income = await db.recurringIncome.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        frequency: frequency || 'MONTHLY',
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: income })
  } catch (error) {
    console.error('Create recurring income error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create recurring income' }, { status: 500 })
  }
}
