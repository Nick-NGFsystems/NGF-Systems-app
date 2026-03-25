import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/unauthorized(.*)',
  '/redirect',
  '/debug(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  const path = req.nextUrl.pathname
  
  if (isPublicRoute(req)) return NextResponse.next()
  
  const { sessionClaims } = await auth()
  if (path === '/admin/dashboard') {
    console.log('ADMIN ATTEMPT - FULL CLAIMS:', JSON.stringify(sessionClaims))
    console.log('ADMIN ATTEMPT - METADATA:', JSON.stringify((sessionClaims as any)?.metadata))
  }
  console.log('PATH:', path)
  console.log('FULL CLAIMS:', JSON.stringify(sessionClaims))

  if (!sessionClaims) {
    return NextResponse.redirect(new URL('/sign-in', req.url))
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role
  console.log('ROLE:', role)

  if (path.startsWith('/admin') && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (path.startsWith('/portal') && role !== 'client') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next|static|favicon\\.ico|api/webhooks|_clerk).*)']
}
