import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    clientId: string
  }>
}

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await context.params

    const requests = await db.changeRequest.findMany({
      where: { client_id: clientId },
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: requests })
  } catch (error) {
    console.error('Get change requests error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch change requests' }, { status: 500 })
  }
}
