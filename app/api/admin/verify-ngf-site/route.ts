import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

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

    let html = ''
    try {
      const response = await fetch(targetUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'NGFsystems-Verifier/1.0' },
      })
      clearTimeout(timeout)
      if (!response.ok) {
        return NextResponse.json({
          compatible: false,
          error: `Site returned HTTP ${response.status} — check the URL`,
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

    return NextResponse.json({
      compatible,
      error: compatible
        ? undefined
        : 'This does not appear to be an NGF-managed site. The page source must reference the NGF content API.',
    })
  } catch {
    return NextResponse.json({ compatible: false, error: 'Verification failed' }, { status: 500 })
  }
}
