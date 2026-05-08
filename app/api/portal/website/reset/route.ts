import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

// POST /api/portal/website/reset
// Deletes the client's entire website_content row (published + draft),
// reverting the live site to its hardcoded source-code defaults.
// Identity is resolved from the Clerk session — never from request body.

export async function POST() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (role !== 'client' && role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized role' }, { status: 401 })
  }

  try {
    const client = await db.client.findUnique({
      where:  { clerk_user_id: userId },
      select: { id: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    await db.websiteContent.deleteMany({ where: { client_id: client.id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[portal/website/reset POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
