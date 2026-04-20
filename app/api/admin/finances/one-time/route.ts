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

    const transactions = await db.oneTimeTransaction.findMany({
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ success: true, data: transactions })
  } catch (error) {
    console.error('Get transactions error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch transactions' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, amount, type, date, notes } = body

    if (!name || !amount || !type || !date) {
      return NextResponse.json(
        { success: false, error: 'Name, amount, type, and date are required' },
        { status: 400 }
      )
    }

    const transaction = await db.oneTimeTransaction.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        type,
        date: new Date(date),
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: transaction })
  } catch (error) {
    console.error('Create transaction error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create transaction' }, { status: 500 })
  }
}
