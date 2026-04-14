import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where: { clerk_user_id: userId },
      include: { config: true },
    })

    if (!client?.config?.site_url) {
      return NextResponse.json({ error: 'No site URL configured' }, { status: 400 })
    }

    const secret = process.env.WEBSITE_REVALIDATION_SECRET
    if (!secret) {
      return NextResponse.json({ error: 'Revalidation not configured' }, { status: 500 })
    }

    const base = client.config.site_url.replace(/\/$/, '')
    const res = await fetch(`${base}/api/revalidate?secret=${secret}`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return NextResponse.json({ error: `Site returned ${res.status}` }, { status: 502 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[portal/website/push]', err)
    return NextResponse.json({ error: 'Failed to push to website' }, { status: 500 })
  }
}
