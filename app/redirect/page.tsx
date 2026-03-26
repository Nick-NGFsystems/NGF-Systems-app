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
      // router.replace('/admin/dashboard')
    } else if (role === 'client') {
      // router.replace('/portal/portal-dashboard')
    } else {
      // router.replace('/unauthorized')
    }
  }, [authLoaded, userLoaded, sessionClaims, user, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="space-y-2 rounded border border-gray-200 bg-gray-50 p-6 text-xs font-mono text-gray-700 max-w-lg w-full mx-4">
        <p className="font-bold text-sm text-gray-900 mb-3">Auth Debug</p>
        <p>authLoaded: {String(authLoaded)}</p>
        <p>userLoaded: {String(userLoaded)}</p>
        <p>sessionClaims.metadata: {JSON.stringify((sessionClaims as Record<string, unknown>)?.metadata ?? 'null')}</p>
        <p>user.publicMetadata: {JSON.stringify(user?.publicMetadata ?? 'null')}</p>
        <p>user.id: {user?.id ?? 'null'}</p>
        <p>user.email: {user?.emailAddresses[0]?.emailAddress ?? 'null'}</p>
      </div>
    </div>
  )
}
