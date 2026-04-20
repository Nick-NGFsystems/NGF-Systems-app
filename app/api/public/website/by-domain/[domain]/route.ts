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

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ domain: string }> }
  ) {
    const { domain } = await params
    const normalized = decodeURIComponent(domain)
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase()
    if (!normalized) {
          return NextResponse.json({ error: 'Domain required' }, { status: 400, headers: CORS })
        }
    try {
          const clients = await db.client.findMany({
                  where: { config: { isNot: null } },
                  select: { id: true, config: { select: { site_url: true } } },
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
                  return NextResponse.json({ error: 'No client found for this domain' }, { status: 404, headers: CORS })
                }
          const websiteContent = await db.websiteContent.findUnique({
                  where: { client_id: client.id },
                })
          return NextResponse.json(
                  { content: websiteContent?.content ?? {}, client_id: client.id, published_at: websiteContent?.published_at ?? null },
                  { headers: CORS }
                )
        } catch (err) {
          console.error('[public/website/by-domain]', err)
          return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS })
        }
  }
