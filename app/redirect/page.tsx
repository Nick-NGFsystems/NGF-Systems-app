import { auth, currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function RedirectPage() {
  const { sessionClaims } = await auth()
  const user = await currentUser()

  console.log('SERVER REDIRECT - sessionClaims:', JSON.stringify(sessionClaims))
  console.log('SERVER REDIRECT - publicMetadata:', JSON.stringify(user?.publicMetadata))

  const claimsRole = (sessionClaims?.metadata as { role?: string })?.role
  const metaRole = (user?.publicMetadata as { role?: string })?.role
  const role = claimsRole || metaRole

  console.log('SERVER REDIRECT - final role:', role)

  if (role === 'admin') redirect('/admin/dashboard')
  if (role === 'client') redirect('/portal/portal-dashboard')

  redirect('/unauthorized')
}
