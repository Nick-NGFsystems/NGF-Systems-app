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

    // Wait for publicMetadata to be available
    const role = (user.publicMetadata as { role?: string })?.role

    console.log('REDIRECT - user id:', user.id)
    console.log('REDIRECT - publicMetadata:', JSON.stringify(user.publicMetadata))
    console.log('REDIRECT - role:', role)

    if (role === 'admin') {
      router.push('/admin/dashboard')
    } else if (role === 'client') {
      router.push('/portal/portal-dashboard')
    } else {
      // Role not set yet - wait and retry
      console.log('REDIRECT - no role found, waiting...')
      setTimeout(() => {
        const retryRole = (user.publicMetadata as { role?: string })?.role
        if (retryRole === 'admin') router.push('/admin/dashboard')
        else if (retryRole === 'client') router.push('/portal/portal-dashboard')
        else router.push('/unauthorized')
      }, 1500)
    }
  }, [user, isLoaded, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <p className="text-gray-500 text-sm">Redirecting...</p>
    </div>
  )
}
