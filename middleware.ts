import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/redirect',
  '/w/(.*)',
  '/preview(.*)',
  '/api/public/(.*)',
])

const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || ''

function isCustomDomain(hostname: string): boolean {
  if (!hostname) return false
  if (hostname.includes('localhost')) return false
  if (hostname.endsWith('.github.dev')) return false
  if (hostname.endsWith('.gitpod.io')) return false
  if (hostname.endsWith('.vercel.app')) return false
  if (hostname.endsWith('.ngrok.io')) return false
  if (APP_DOMAIN && (hostname === APP_DOMAIN || hostname === `www.${APP_DOMAIN}`)) return false
  return true
}

export default clerkMiddleware(async (auth, req) => {
  const hostname = req.headers.get('host') || ''

  // Custom domain routing — rewrite to domain resolver, no auth required
  if (isCustomDomain(hostname)) {
    const url = req.nextUrl.clone()
    const originalPath = req.nextUrl.pathname
    url.pathname = `/w/domain/${encodeURIComponent(hostname)}${originalPath === '/' ? '' : originalPath}`
    return NextResponse.rewrite(url)
  }

  const path = req.nextUrl.pathname

  if (isPublicRoute(req)) return NextResponse.next()

  const { sessionClaims } = await auth()

  if (!sessionClaims) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role

  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/portal') && role !== 'client') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next|static|favicon\\.ico|api/webhooks|api/leads|api/ingest|_clerk).*)'],
}
