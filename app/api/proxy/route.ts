import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  const { userId } = await auth()
  if (!userId) return new NextResponse('Unauthorized', { status: 401 })

  if (!url) return new NextResponse('Missing url param', { status: 400 })

  let target: string
  try {
    target = url.startsWith('http') ? url : `https://${url}`
    new URL(target) // validate
  } catch {
    return new NextResponse('Invalid url', { status: 400 })
  }

  try {
    // Block SSRF: reject private/internal IP ranges and hostnames
    try {
      const parsed = new URL(target)
      const h = parsed.hostname
      if (/^(localhost|127\.|\.10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|::1)/i.test(h)) {
        return new NextResponse('Forbidden', { status: 403 })
      }
    } catch {
      return new NextResponse('Invalid url', { status: 400 })
    }
        const upstream = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; NGF-SitePreview/1.0)',
        Accept: 'text/html,application/xhtml+xml,*/*',
      },
      redirect: 'follow',
    })

    const contentType = upstream.headers.get('content-type') ?? 'text/html'

    if (!contentType.includes('text/html')) {
      const buf = await upstream.arrayBuffer()
      return new NextResponse(buf, {
        status: upstream.status,
        headers: { 'Content-Type': contentType },
      })
    }

    let html = await upstream.text()

    // Inject <base> so relative URLs resolve against the real origin
    const origin = new URL(target).origin
    const baseTag = `<base href="${origin}/">`
    if (!html.includes('<base')) {
      html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`)
    }

    // Inject postMessage bridge so the editor can reload the frame after save
    const bridge = `<script>
(function () {
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'reloadPreview') {
      window.location.reload()
    }
  })
})()
</script>`
    html = html.replace('</body>', bridge + '</body>')

    // Strip framing-prevention headers and return clean HTML
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Intentionally omit X-Frame-Options and CSP frame-ancestors
      },
    })
  } catch (err) {
    return new NextResponse(`Proxy error: ${String(err)}`, { status: 502 })
  }
}
