import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { flattenContent, SiteContent } from '@/lib/website-schema'

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/public/content?domain=<domain>  OR  ?client_id=<id>
//
// Returns published website content. Two response shapes:
//
//   Default (no `?shape=flat`):
//     { content: { hero: { headline: '...' }, services: { items: [...] } }, client_id }
//
//   With `?shape=flat`:
//     { content: { 'hero.headline': '...', 'services.items.0.name': '...' }, client_id }
//
// Client sites can pick whichever shape is easier to consume. Full CORS; no auth.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawDomain  = searchParams.get('domain')
  const rawClientId = searchParams.get('client_id')
  const shape      = searchParams.get('shape') // 'flat' | null

  if (!rawDomain && !rawClientId) {
    return NextResponse.json(
      { error: 'domain or client_id query param required' },
      { status: 400, headers: CORS },
    )
  }

  try {
    let clientId: string | null = rawClientId

    if (!clientId && rawDomain) {
      const normalized = decodeURIComponent(rawDomain)
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase()

      const clients = await db.client.findMany({
        where:  { config: { isNot: null } },
        select: { id: true, config: { select: { site_url: true } } },
      })

      const match = clients.find((c) => {
        const url = c.config?.site_url
        if (!url) return false
        const n = url
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .replace(/\/$/, '')
          .toLowerCase()
        return n === normalized
      })

      clientId = match?.id ?? null
    }

    if (!clientId) {
      // Unknown domain → empty content so the site falls through to defaults.
      return NextResponse.json({ content: shape === 'flat' ? {} : {} }, { headers: CORS })
    }

    const row = await db.websiteContent.findUnique({
      where:  { client_id: clientId },
      select: { content: true, published_at: true, client_id: true },
    })

    const nested = (row?.content ?? {}) as SiteContent

    const payload = shape === 'flat'
      ? flattenContent(nested)
      : nested

    return NextResponse.json(
      {
        content:      payload,
        client_id:    clientId,
        published_at: row?.published_at?.toISOString() ?? null,
      },
      { headers: CORS },
    )
  } catch (err) {
    console.error('[public/content]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
