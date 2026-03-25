'use client'

import { useUser } from '@clerk/nextjs'

export default function DebugPage() {
  const { user, isLoaded, isSignedIn } = useUser()

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Debug: Clerk Public Metadata</h1>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <p>
          <span className="font-medium">isLoaded:</span> {String(isLoaded)}
        </p>
        <p>
          <span className="font-medium">isSignedIn:</span> {String(isSignedIn)}
        </p>
        <p>
          <span className="font-medium">userId:</span> {user?.id ?? 'null'}
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="mb-2 text-lg font-medium">publicMetadata</h2>
        <pre className="overflow-x-auto text-sm text-gray-800">
          {JSON.stringify(user?.publicMetadata ?? null, null, 2)}
        </pre>
      </div>
    </main>
  )
}
