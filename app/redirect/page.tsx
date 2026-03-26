'use client'

import { useAuth, useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

export default function RedirectPage() {
  const { isLoaded: authLoaded, sessionClaims } = useAuth()
  const { isLoaded: userLoaded, user } = useUser()
  const router = useRouter()
  const attempts = useRef(0)

  useEffect(() => {
    if (!authLoaded || !userLoaded) return

    const claimsRole = (sessionClaims?.metadata as { role?: string })?.role
    const metaRole = (user?.publicMetadata as { role?: string })?.role
    const role = claimsRole || metaRole

    if (role === 'admin') {
      router.replace('/admin/dashboard')
    } else if (role === 'client') {
      router.replace('/portal/portal-dashboard')
    } else if (attempts.current < 5) {
      // Webhook may not have fired yet — retry up to 5 times with increasing delay
      attempts.current += 1
      const delay = attempts.current * 1000
      const timer = setTimeout(() => {
        user?.reload()
      }, delay)
      return () => clearTimeout(timer)
    } else {
      router.replace('/unauthorized')
    }
  }, [authLoaded, userLoaded, sessionClaims, user, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-sm text-gray-500">Setting up your account…</p>
    </div>
  )
}

