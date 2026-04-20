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
    const { date, miles, ratePerMile, purpose, notes } = body

    const parsedMiles = miles !== undefined ? parseFloat(miles) : undefined
    const parsedRatePerMile = ratePerMile !== undefined ? parseFloat(ratePerMile) : undefined

    if (
      (parsedMiles !== undefined && (!Number.isFinite(parsedMiles) || parsedMiles <= 0)) ||
      (parsedRatePerMile !== undefined && (!Number.isFinite(parsedRatePerMile) || parsedRatePerMile <= 0))
    ) {
      return NextResponse.json(
        { success: false, error: 'Miles and rate per mile must be positive numbers' },
        { status: 400 }
      )
    }

    const mileageEntry = await db.workMileage.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(parsedMiles !== undefined && { miles: parsedMiles }),
        ...(parsedRatePerMile !== undefined && { rate_per_mile: parsedRatePerMile }),
        ...(purpose && { purpose: purpose.trim() }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, data: mileageEntry })
  } catch (error) {
    console.error('Update work mileage error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update work mileage entry' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    await db.workMileage.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete work mileage error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete work mileage entry' }, { status: 500 })
  }
}
