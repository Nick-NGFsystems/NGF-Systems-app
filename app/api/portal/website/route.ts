import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { getTemplate } from '@/lib/templates'

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

    const editorContent = websiteContent?.draft_content ?? websiteContent?.content ?? {}
    const schema = getTemplate(client.config?.template_id)

    return NextResponse.json({
      content: editorContent,
      published_content: websiteContent?.content ?? {},
      has_draft: !!websiteContent?.draft_content,
      site_url: client.config?.site_url ?? null,
      client_id: client.id,
      schema,
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

    // Save to draft_content only — does NOT touch published content or affect live website
    await db.websiteContent.upsert({
      where: { client_id: client.id },
      update: { draft_content: content },
      create: {
        client_id: client.id,
        content: {},        // Published starts empty until first publish
        draft_content: content,
      },
    })

    return NextResponse.json({ success: true, has_draft: true })
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
