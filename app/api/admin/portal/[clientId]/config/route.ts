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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'NGFsystems-Verifier/1.0' },
    })
    clearTimeout(timeout)
    if (!response.ok) {
      return { ok: false, error: `Site returned HTTP ${response.status}` }
    }
    const html = await response.text()
    const compatible =
      html.includes('app.ngfsystems.com/api/public/website') ||
      html.includes('ngfsystems.com/api/public/website')
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
    if (newSiteUrl) {
      const existing = await db.clientConfig.findUnique({
        where: { client_id: clientId },
        select: { site_url: true },
      })
      // Only re-verify if the URL is actually changing
      if (existing?.site_url !== newSiteUrl) {
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
