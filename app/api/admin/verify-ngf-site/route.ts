import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

// Always execute dynamically; never cache the route's response or its outbound fetches.
export const dynamic  = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function POST(request: NextRequest) {
  const isAdmin = await validateAdmin()
  if (!isAdmin) {
    return NextResponse.json({ compatible: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url } = (await request.json()) as { url: string }

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ compatible: false, error: 'URL is required' }, { status: 400 })
    }

    const targetUrl = url.startsWith('http') ? url : `https://${url}`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 7000)

    // Append a cachebust query param so Vercel's edge network (and any upstream
    // caches) serve us fresh HTML rather than a stale static prerender.
    const separator    = targetUrl.includes('?') ? '&' : '?'
    const bustedUrl    = `${targetUrl}${separator}__ngf_verify=${Date.now()}`

    let html = ''
    try {
      const response = await fetch(bustedUrl, {
        signal:  controller.signal,
        cache:   'no-store',
        headers: {
          'User-Agent':     'NGFsystems-Verifier/1.0',
          'Cache-Control':  'no-cache, no-store, max-age=0',
          'Pragma':         'no-cache',
        },
      })
      clearTimeout(timeout)
      if (!response.ok) {
        return NextResponse.json({
          compatible: false,
          error: `Site returned HTTP ${response.status} — check the URL`,
          debug: { fetched_url: bustedUrl, status: response.status },
        })
      }
      html = await response.text()
    } catch (err) {
      clearTimeout(timeout)
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      return NextResponse.json({
        compatible: false,
        error: isTimeout
          ? 'Site did not respond within 7 seconds'
          : 'Could not reach the site — verify the URL is live and accessible',
      })
    }

    const compatible =
      html.includes('ngf-public-api') ||                          // meta tag in layout
      html.includes('app.ngfsystems.com/api/public/content') ||   // content API URL
      html.includes('app.ngfsystems.com/api/public/website') ||   // legacy path
      html.includes('ngfsystems.com/api/public')

    // Debug payload — included when verification fails so we can see WHY.
    // Safe to include; only returned to admin users.
    const debug = compatible
      ? undefined
      : {
          fetched_url:    targetUrl,
          html_bytes:     html.length,
          first_200:      html.slice(0, 200),
          has_ngf_public: html.includes('ngf-public-api'),
          has_meta_tag:   /<meta[^>]*ngf-public-api[^>]*>/i.test(html),
        }

    return NextResponse.json({
      compatible,
      error: compatible
        ? undefined
        : 'This does not appear to be an NGF-managed site. The page source must reference the NGF content API.',
      debug,
    })
  } catch (err) {
    return NextResponse.json({
      compatible: false,
      error:      'Verification failed',
      debug:      err instanceof Error ? { message: err.message, name: err.name } : { message: String(err) },
    }, { status: 500 })
  }
}
