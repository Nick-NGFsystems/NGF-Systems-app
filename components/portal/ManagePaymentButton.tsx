'use client'

import { useState } from 'react'

// Opens Stripe Customer Portal so the client can update payment method,
// view invoices in Stripe's own UI, and manage auto-pay.
export default function ManagePaymentButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function onClick() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/create-portal', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    '{}',
      })
      const json = await res.json()
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Failed to open billing portal')
        setLoading(false)
        return
      }
      window.location.href = json.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-lg border border-slate-900 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-60"
      >
        {loading ? 'Opening…' : 'Manage payment method ↗'}
      </button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  )
}
