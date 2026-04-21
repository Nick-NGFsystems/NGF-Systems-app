'use client'

import { useEffect } from 'react'

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[portal error boundary]', error)
  }, [error])

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="w-full max-w-md rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-red-900">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-red-600">
          {error.message || 'An unexpected error occurred. Please refresh the page.'}
        </p>
        <div className="mt-4 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
          >
            Try again
          </button>
          <a
            href="/portal"
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Go to dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
