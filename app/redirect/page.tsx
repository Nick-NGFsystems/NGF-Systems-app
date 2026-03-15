'use client'

import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function RedirectPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return

    if (!user) {
      router.push('/sign-in')
      return
    }

    const role = (user.publicMetadata as { role?: string })?.role

    if (role === 'admin') {
      router.push('/admin/dashboard')
    } else if (role === 'client') {
      router.push('/portal/portal-dashboard')
    } else {
      router.push('/sign-in')
    }
  }, [user, isLoaded, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-gray-500 text-sm">Redirecting...</p>
    </div>
  )
}
