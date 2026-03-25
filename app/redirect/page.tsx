import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RedirectPage() {
  const { sessionClaims } = await auth()
  const user = await currentUser()

  const claimsRole = (sessionClaims?.metadata as { role?: string })?.role
  const metaRole = (user?.publicMetadata as { role?: string })?.role
  const role = claimsRole || metaRole

  if (role === 'admin') redirect('/admin/dashboard')
  if (role === 'client') redirect('/portal/portal-dashboard')

  redirect('/unauthorized')
}
