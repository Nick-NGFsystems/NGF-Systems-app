import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where: { clerk_user_id: userId },
      include: { config: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const websiteContent = await db.websiteContent.findUnique({
      where: { client_id: client.id },
    })

    // If no content saved yet, return empty — website uses its own fallback values
    return NextResponse.json({
      ...(websiteContent ?? {}),
      content: websiteContent?.content ?? {},
      site_url: client.config?.site_url ?? null,
      client_id: client.id,
    })
  } catch (err) {
    console.error('[portal/website GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where: { clerk_user_id: userId },
      include: { config: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const { content } = await request.json()

    const websiteContent = await db.websiteContent.upsert({
      where: { client_id: client.id },
      update: { content },
      create: { client_id: client.id, content },
    })

    return NextResponse.json(websiteContent)
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
