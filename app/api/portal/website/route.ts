import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import {
  DEFAULT_SCHEMA,
  applySchemaDefaults,
  SiteSchema,
  SiteContent,
} from '@/lib/website-schema'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/portal/website
//
// Returns the editor payload: schema (from DB or default), content (draft if
// present, else published), published_content, flags, site metadata.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where:   { clerk_user_id: userId },
      include: { config: true },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    // Cast the result to include schema_json — the field is in prisma/schema.prisma
    // and will exist on the runtime client; the sandbox's cached Prisma client
    // may not have picked it up yet, and TS should not block on that.
    const row = (await db.websiteContent.findUnique({
      where: { client_id: client.id },
    })) as unknown as (null | {
      content:       unknown
      draft_content: unknown
      schema_json?:  unknown
      published_at:  Date | null
    })

    const schema: SiteSchema =
      (row?.schema_json as SiteSchema | null | undefined) ?? DEFAULT_SCHEMA

    const publishedContent = (row?.content ?? {}) as SiteContent
    const draftContent     = (row?.draft_content ?? null) as SiteContent | null

    // Apply schema defaults to whichever copy the editor is going to show.
    const editorContent = applySchemaDefaults(draftContent ?? publishedContent, schema)
    const baseContent   = applySchemaDefaults(publishedContent, schema)

    return NextResponse.json({
      schema,
      content:           editorContent,
      published_content: baseContent,
      has_draft:         !!draftContent,
      published_at:      row?.published_at?.toISOString() ?? null,
      site_url:          client.config?.site_url ?? null,
      client_id:         client.id,
    })
  } catch (err) {
    console.error('[portal/website GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/portal/website — save draft
//
// Writes to draft_content only — never touches published content.
// Publishing is a separate call to /api/portal/website/push.
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const client = await db.client.findUnique({
      where: { clerk_user_id: userId },
    })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const content = body?.content

    if (!content || typeof content !== 'object') {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    await db.websiteContent.upsert({
      where:  { client_id: client.id },
      update: { draft_content: content },
      create: {
        client_id:     client.id,
        content:       {},
        draft_content: content,
      },
    })

    return NextResponse.json({ success: true, has_draft: true })
  } catch (err) {
    console.error('[portal/website POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
