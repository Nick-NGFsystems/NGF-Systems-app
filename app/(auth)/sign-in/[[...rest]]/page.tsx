"use client"

import { SignIn, useUser } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

export default function SignInPage() {
  const { isLoaded } = useUser()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const ready = mounted && isLoaded

  return (
    <main className="flex min-h-screen bg-slate-900">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16">
        <p className="font-sans text-3xl font-semibold tracking-tight text-blue-400">NGFsystems</p>
        <h1 className="mt-6 max-w-md font-sans text-4xl font-semibold tracking-tight text-white">
          Client Portal &amp; Business Management
        </h1>
        <p className="mt-4 max-w-md text-base text-slate-300">
          Sign in to view project updates, track invoices, and manage website requests.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Projects</p>
            <p className="mt-1 text-sm text-white">Track active work and milestones</p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">Invoices</p>
            <p className="mt-1 text-sm text-white">Review billing and payment status</p>
          </div>
        </div>
      </div>

      {/* Right sign-in panel */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-6 lg:hidden">
            <p className="font-sans text-2xl font-semibold tracking-tight text-blue-400">NGFsystems</p>
          </div>
          {ready ? (
            <SignIn
              appearance={{
                elements: {
                  card: 'shadow-none border-0',
                  rootBox: 'w-full',
                },
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-400" />
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
