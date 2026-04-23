'use client'

import { useState } from 'react'
import type { PlanKey } from '@/lib/stripe'

type Props = {
  planKey: PlanKey
  className?: string
  children: React.ReactNode
  disabled?: boolean
}

export default function SubscribeButton({ planKey, className, children, disabled }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function onClick() {
    if (loading || disabled) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ planKey }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data?.url) {
        setError(data?.error ?? 'Unable to start checkout. Please try again.')
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch (err) {
      console.error(err)
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className={
          className ??
          'w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {loading ? 'Redirecting…' : children}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
