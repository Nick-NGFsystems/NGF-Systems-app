import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RedirectPage() {
  const { sessionClaims } = await auth()

  console.log('REDIRECT SESSIONCLAIMS:', JSON.stringify(sessionClaims))

  if (!sessionClaims) {
    redirect('/sign-in')
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role

  if (role === 'admin') {
    redirect('/admin/dashboard')
  }

  if (role === 'client') {
    redirect('/portal/portal-dashboard')
  }

  // Default fallback
  redirect('/sign-in')
}
