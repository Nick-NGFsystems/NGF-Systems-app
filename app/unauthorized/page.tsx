'use client'

import { useClerk } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'

export default function UnauthorizedPage() {
  const { signOut } = useClerk()
  const router = useRouter()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white gap-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Access Denied</h1>
        <p className="mt-2 text-sm text-gray-500">You don&apos;t have permission to view this page.</p>
      </div>
      <button
        onClick={() => signOut(() => router.push('/sign-in'))}
        className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        Sign out and switch accounts
      </button>
    </div>
  )
}
