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

    const mileage = await db.workMileage.findMany({
      orderBy: { date: 'desc' },
    })

    return NextResponse.json({ success: true, data: mileage })
  } catch (error) {
    console.error('Get work mileage error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch work mileage' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { date, miles, ratePerMile, purpose, notes } = body

    if (!date || miles === undefined || ratePerMile === undefined || !purpose) {
      return NextResponse.json(
        { success: false, error: 'Date, miles, rate per mile, and purpose are required' },
        { status: 400 }
      )
    }

    const parsedMiles = parseFloat(miles)
    const parsedRatePerMile = parseFloat(ratePerMile)

    if (!Number.isFinite(parsedMiles) || parsedMiles <= 0 || !Number.isFinite(parsedRatePerMile) || parsedRatePerMile <= 0) {
      return NextResponse.json(
        { success: false, error: 'Miles and rate per mile must be positive numbers' },
        { status: 400 }
      )
    }

    const mileageEntry = await db.workMileage.create({
      data: {
        date: new Date(date),
        miles: parsedMiles,
        rate_per_mile: parsedRatePerMile,
        purpose: purpose.trim(),
        notes: notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: mileageEntry })
  } catch (error) {
    console.error('Create work mileage error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create work mileage entry' }, { status: 500 })
  }
}
