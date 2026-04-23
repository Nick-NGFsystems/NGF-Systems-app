import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{ clientId: string }>
}

interface ConfigPayload {
  page_request?: boolean
  page_website?: boolean
  page_content?: boolean
  page_invoices?: boolean
  feature_blog?: boolean
  feature_products?: boolean
  feature_booking?: boolean
  feature_gallery?: boolean
  booking_url?: string | null
  database_url?: string | null
  site_url?: string | null
  site_repo?: string | null
}

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

async function verifyNgfSite(url: string): Promise<{ ok: boolean; error?: string }> {
  const targetUrl = url.startsWith('http') ? url : `https://${url}`
  // Cachebust so Vercel's edge doesn't serve a stale prerender to our server fetch.
  const separator = targetUrl.includes('?') ? '&' : '?'
  const bustedUrl = `${targetUrl}${separator}__ngf_verify=${Date.now()}`

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(bustedUrl, {
      signal:  controller.signal,
      cache:   'no-store',
      headers: {
        'User-Agent':    'NGFsystems-Verifier/1.0',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'Pragma':        'no-cache',
      },
    })
    clearTimeout(timeout)
    if (!response.ok) {
      return { ok: false, error: `Site returned HTTP ${response.status}` }
    }
    const html = await response.text()
    // Must stay in sync with /api/admin/verify-ngf-site — same markers.
    const compatible =
      html.includes('ngf-public-api') ||                          // meta tag in layout
      html.includes('app.ngfsystems.com/api/public/content') ||   // current content API
      html.includes('app.ngfsystems.com/api/public/website') ||   // legacy path
      html.includes('ngfsystems.com/api/public')
    return compatible
      ? { ok: true }
      : {
          ok: false,
          error:
            'This does not appear to be an NGF-managed site. Only NGF-built websites can use the content editor.',
        }
  } catch (err) {
    clearTimeout(timeout)
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    return {
      ok: false,
      error: isTimeout
        ? 'Site did not respond within 7 seconds'
        : 'Could not reach the site — verify the URL is live and accessible',
    }
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await context.params
    const body = (await request.json()) as ConfigPayload

    // Normalize the incoming site_url
    const newSiteUrl =
      body.site_url !== undefined ? (body.site_url?.trim() || null) : undefined

    // If site_url is being set to a non-null value, verify it's NGF-compatible
    // AND that no OTHER client already owns this domain — duplicates lead to
    // cross-contamination via the /api/public/content domain resolver.
    if (newSiteUrl) {
      const existing = await db.clientConfig.findUnique({
        where: { client_id: clientId },
        select: { site_url: true },
      })
      // Only re-verify if the URL is actually changing
      if (existing?.site_url !== newSiteUrl) {
        // Normalize for comparison (protocol, www, trailing slash, case)
        const norm = (s: string) =>
          s.trim().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '').toLowerCase()
        const newNorm = norm(newSiteUrl)

        // Reject if another client already has this domain. Normalized compare
        // in JS since Prisma can't express LOWER(TRIM(...)) matches cleanly.
        const others = await db.clientConfig.findMany({
          where: {
            client_id: { not: clientId },
            site_url:  { not: null },
          },
          select: { client_id: true, site_url: true },
        })
        const conflictRow = others.find(o => o.site_url && norm(o.site_url) === newNorm)
        if (conflictRow) {
          return NextResponse.json(
            {
              success: false,
              error:   `Another client already owns this domain (${conflictRow.site_url}). Each domain can only belong to one client — remove it from the other client first, or use a different domain.`,
              conflict: { other_client_id: conflictRow.client_id, site_url: conflictRow.site_url },
            },
            { status: 409 }
          )
        }

        const verification = await verifyNgfSite(newSiteUrl)
        if (!verification.ok) {
          return NextResponse.json(
            { success: false, error: verification.error },
            { status: 422 }
          )
        }
      }
    }

    const payload = {
      ...(body.page_request !== undefined && { page_request: body.page_request }),
      ...(body.page_website !== undefined && { page_website: body.page_website }),
      ...(body.page_content !== undefined && { page_content: body.page_content }),
      ...(body.page_invoices !== undefined && { page_invoices: body.page_invoices }),
      ...(body.feature_blog !== undefined && { feature_blog: body.feature_blog }),
      ...(body.feature_products !== undefined && { feature_products: body.feature_products }),
      ...(body.feature_booking !== undefined && { feature_booking: body.feature_booking }),
      ...(body.feature_gallery !== undefined && { feature_gallery: body.feature_gallery }),
      ...(body.booking_url !== undefined && { booking_url: body.booking_url?.trim() || null }),
      ...(body.database_url !== undefined && { database_url: body.database_url?.trim() || null }),
      ...(newSiteUrl !== undefined && { site_url: newSiteUrl }),
      ...(body.site_repo !== undefined && { site_repo: body.site_repo?.trim() || null }),
    }

    const config = await db.clientConfig.upsert({
      where: { client_id: clientId },
      update: payload,
      create: {
        client_id: clientId,
        ...payload,
      },
    })

    return NextResponse.json({ success: true, data: config })
  } catch (error) {
    console.error('Update portal config error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update portal config' }, { status: 500 })
  }
}
