'use client'

import { SignOutButton } from '@clerk/nextjs'

export default function PortalDashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Portal Dashboard</h1>
      <SignOutButton redirectUrl="/sign-in">
        <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Sign Out
        </button>
      </SignOutButton>
    </div>
  )
}
