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

    const allocations = await db.budgetAllocation.findMany({
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: allocations })
  } catch (error) {
    console.error('Get allocations error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch allocations' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, percentage, notes } = body

    if (!name || percentage === undefined) {
      return NextResponse.json(
        { success: false, error: 'Name and percentage are required' },
        { status: 400 }
      )
    }

    const allocation = await db.budgetAllocation.create({
      data: {
        name: name.trim(),
        percentage: parseFloat(percentage),
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: allocation })
  } catch (error) {
    console.error('Create allocation error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create allocation' }, { status: 500 })
  }
}
