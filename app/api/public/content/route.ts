import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * Flatten a nested object to dot-notation key-value pairs.
 * e.g. { hero: { eyebrow: 'X', headline: 'Y' } } → { 'hero.eyebrow': 'X', 'hero.headline': 'Y' }
 * Arrays are flattened as 'section.0.field', 'section.1.field', etc.
 */
function flatten(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') {
      result[path] = value
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'string') {
          result[`${path}.${i}`] = item
        } else if (typeof item === 'object' && item !== null) {
          Object.assign(result, flatten(item as Record<string, unknown>, `${path}.${i}`))
        }
      })
    } else if (typeof value === 'object' && value !== null) {
      Object.assign(result, flatten(value as Record<string, unknown>, path))
    }
  }
  return result
}

/**
 * GET /api/public/content?domain=<domain>
 *
 * Returns published website content as flat dot-notation key-value pairs.
 * Used by custom client sites (e.g. WrenchTime Cycles) to fetch their content
 * from the NGF portal system.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawDomain = searchParams.get('domain')

  if (!rawDomain) {
    return NextResponse.json({ error: 'domain query param required' }, { status: 400, headers: CORS })
  }

  const normalized = decodeURIComponent(rawDomain)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '')
    .toLowerCase()

  try {
    // Look up client by matching site_url
    const clients = await db.client.findMany({
      where: { config: { isNot: null } },
      select: {
        id: true,
        config: { select: { site_url: true } },
      },
    })

    const client = clients.find((c) => {
      if (!c.config?.site_url) return false
      const siteNorm = c.config.site_url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, '')
        .toLowerCase()
      return siteNorm === normalized
    })

    if (!client) {
      // Return empty content rather than 404 — site uses defaults when nothing is saved
      return NextResponse.json({ content: {} }, { headers: CORS })
    }

    const websiteContent = await db.websiteContent.findUnique({
      where: { client_id: client.id },
    })

    const raw = (websiteContent?.content ?? {}) as Record<string, unknown>
    const content = flatten(raw)

    return NextResponse.json({ content, client_id: client.id }, { headers: CORS })
  } catch (err) {
    console.error('[public/content]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
  }
}
