'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function RedirectPage() {
  const { isLoaded: authLoaded, sessionClaims } = useAuth()
  const { isLoaded: userLoaded, user } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!authLoaded || !userLoaded) return

    const claimsRole = (sessionClaims?.metadata as { role?: string })?.role
    const metaRole = (user?.publicMetadata as { role?: string })?.role
    const role = claimsRole || metaRole

    if (role === 'admin') {
      router.replace('/admin/dashboard')
    } else if (role === 'client') {
      router.replace('/portal/portal-dashboard')
    } else {
      router.replace('/unauthorized')
    }
  }, [authLoaded, userLoaded, sessionClaims, user, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-sm text-gray-500">Signing you in…</p>
    </div>
  )
}
