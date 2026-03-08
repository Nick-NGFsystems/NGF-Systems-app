import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher(['/', '/sign-in(.*)', '/sign-up(.*)', '/unauthorized'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isPortalRoute = createRouteMatcher(['/portal(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return

  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string })?.role

  if (isAdminRoute(req) && role !== 'admin') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }

  if (isPortalRoute(req) && role !== 'client') {
    return NextResponse.redirect(new URL('/unauthorized', req.url))
  }
})

export const config = {
  matcher: ['/((?!_next|static|favicon.ico).*)']
}
