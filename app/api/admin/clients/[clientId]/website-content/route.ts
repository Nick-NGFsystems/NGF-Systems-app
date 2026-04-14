import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

interface RouteContext { params: Promise<{ clientId: string }> }

async function validateAdmin() {
  const { sessionClaims } = await auth()
  return (sessionClaims?.metadata as { role?: string })?.role === 'admin'
}

export async function DELETE(_req: Request, context: RouteContext) {
  if (!await validateAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId } = await context.params
  try {
    await db.websiteContent.deleteMany({ where: { client_id: clientId } })
    return NextResponse.json({ success: true, message: 'Website content cleared' })
  } catch (err) {
    console.error('[admin/clients/website-content DELETE]', err)
    return NextResponse.json({ error: 'Failed to clear content' }, { status: 500 })
  }
}

export async function GET(_req: Request, context: RouteContext) {
  if (!await validateAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { clientId } = await context.params
  try {
    const wc = await db.websiteContent.findUnique({ where: { client_id: clientId } })
    return NextResponse.json({ success: true, data: wc })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 })
  }
}
