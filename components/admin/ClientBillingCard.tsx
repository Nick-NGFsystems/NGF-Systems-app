'use client'

import { useCallback, useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// ClientBillingCard
//
// Admin-side card on /admin/clients/[id] for managing billing:
//   - View current subscriptions, payments, and Stripe invoices
//   - Create a subscription at any amount + interval (send_invoice mode)
//   - Send a one-time invoice (for setup fees, add-on work, etc.)
//   - Cancel / resume / force-cancel subscriptions
//   - Open the Stripe dashboard for this customer
// ─────────────────────────────────────────────────────────────────────────────

type Subscription = {
  id:                     string
  stripe_subscription_id: string | null
  plan_name:              string
  plan_type:              string
  status:                 string
  amount_cents:           number
  current_period_end:     string | null
  cancel_at_period_end:   boolean
  created:                string
}

type Payment = {
  id:                      string
  stripe_checkout_session: string | null
  plan_name:               string
  status:                  string
  amount_cents:            number
  created:                 string
}

type StripeInvoice = {
  id:                 string
  hosted_invoice_url: string | null
  status:             string | null
  amount_due:         number
  amount_paid:        number
  created:            number
  number:             string | null
}

type BillingData = {
  client_id:            string
  stripe_customer_id:   string | null
  stripe_dashboard_url: string | null
  subscriptions:        Subscription[]
  payments:             Payment[]
  stripe_invoices:      StripeInvoice[]
}

function money(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

function fmtDate(d: string | number | null | undefined): string {
  if (d === null || d === undefined) return '—'
  const date = typeof d === 'number' ? new Date(d * 1000) : new Date(d)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function statusPill(status: string) {
  const s = status.toUpperCase()
  const color =
    s === 'ACTIVE' || s === 'TRIALING'                ? 'bg-emerald-100 text-emerald-800' :
    s === 'PAST_DUE' || s === 'UNPAID'                ? 'bg-amber-100 text-amber-800' :
    s === 'CANCELLED' || s === 'CANCELED'             ? 'bg-gray-100 text-gray-700' :
    s === 'PAID'                                      ? 'bg-emerald-100 text-emerald-800' :
    s === 'REFUNDED'                                  ? 'bg-gray-100 text-gray-700' :
    s === 'DISPUTED'                                  ? 'bg-red-100 text-red-800' :
                                                        'bg-gray-100 text-gray-700'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{s}</span>
}

export default function ClientBillingCard({ clientId }: { clientId: string }) {
  const [data, setData]       = useState<BillingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const [subOpen, setSubOpen]   = useState(false)
  const [invOpen, setInvOpen]   = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/billing`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error ?? 'Load failed')
      setData(json.data as BillingData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function action(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`/api/admin/clients/${clientId}/billing`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok || !json.success) return { ok: false, error: json.error }
    return { ok: true }
  }

  if (loading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
        <p className="mt-2 text-sm text-gray-500">Loading…</p>
      </section>
    )
  }
  if (error || !data) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900">Billing</h2>
        <p className="mt-2 text-sm text-red-800">{error ?? 'Could not load'}</p>
        <button onClick={load} className="mt-3 rounded-lg bg-white px-3 py-1.5 text-sm text-red-900 border border-red-200 hover:bg-red-100">Retry</button>
      </section>
    )
  }

  const activeSubs = data.subscriptions.filter(s => s.status === 'ACTIVE' || s.status === 'TRIALING' || s.status === 'PAST_DUE')

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Billing</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Stripe customer: {data.stripe_customer_id ?? 'not yet created'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data.stripe_dashboard_url ? (
            <a
              href={data.stripe_dashboard_url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Open in Stripe ↗
            </a>
          ) : null}
        </div>
      </header>

      {/* Actions */}
      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubOpen(true)}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          + Create subscription
        </button>
        <button
          type="button"
          onClick={() => setInvOpen(true)}
          className="rounded-lg border border-slate-900 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50"
        >
          + Send one-time invoice
        </button>
      </div>

      {/* Subscriptions */}
      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Subscriptions</p>
        {data.subscriptions.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500">
            No subscriptions yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {data.subscriptions.map((sub) => {
              const canCancel = sub.stripe_subscription_id && (sub.status === 'ACTIVE' || sub.status === 'TRIALING' || sub.status === 'PAST_DUE')
              return (
                <li key={sub.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {money(sub.amount_cents)}{' '}
                        <span className="text-xs font-normal text-gray-500">/ {sub.plan_type === 'YEARLY' ? 'yr' : 'mo'}</span>
                      </p>
                      <p className="text-xs text-gray-500">{sub.plan_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {statusPill(sub.status)}
                      <span className="text-xs text-gray-500">
                        {sub.cancel_at_period_end && sub.current_period_end
                          ? `Cancels ${fmtDate(sub.current_period_end)}`
                          : sub.current_period_end
                          ? `Renews ${fmtDate(sub.current_period_end)}`
                          : ''}
                      </span>
                    </div>
                  </div>
                  {canCancel ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {sub.cancel_at_period_end ? (
                        <button
                          type="button"
                          onClick={async () => {
                            const r = await action({ action: 'resume_subscription', subscription_id: sub.stripe_subscription_id })
                            if (r.ok) load(); else alert(r.error)
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          Resume
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm('Cancel this subscription at end of the current period?')) return
                            const r = await action({ action: 'cancel_subscription', subscription_id: sub.stripe_subscription_id })
                            if (r.ok) load(); else alert(r.error)
                          }}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          Cancel at period end
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={async () => {
                          if (!confirm('Cancel this subscription NOW (skip remaining period)? This is immediate.')) return
                          const r = await action({ action: 'cancel_subscription_now', subscription_id: sub.stripe_subscription_id })
                          if (r.ok) load(); else alert(r.error)
                        }}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Cancel now
                      </button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Stripe invoices */}
      {data.stripe_invoices.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Stripe invoices</p>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {data.stripe_invoices.slice(0, 10).map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {inv.number ?? inv.id} &nbsp;·&nbsp; {money(inv.amount_due)}
                  </p>
                  <p className="text-xs text-gray-500">{fmtDate(inv.created)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {statusPill(inv.status ?? 'unknown')}
                  {inv.hosted_invoice_url ? (
                    <a
                      href={inv.hosted_invoice_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View ↗
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Local payments */}
      {data.payments.length > 0 ? (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Recent payments (tracked locally)</p>
          <ul className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-100">
            {data.payments.slice(0, 10).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{money(p.amount_cents)} &nbsp;·&nbsp; {p.plan_name}</p>
                  <p className="text-xs text-gray-500">{fmtDate(p.created)}</p>
                </div>
                {statusPill(p.status)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {subOpen ? (
        <CreateSubscriptionModal
          clientId={clientId}
          onClose={() => setSubOpen(false)}
          onDone={() => { setSubOpen(false); load() }}
        />
      ) : null}
      {invOpen ? (
        <CreateInvoiceModal
          clientId={clientId}
          onClose={() => setInvOpen(false)}
          onDone={() => { setInvOpen(false); load() }}
        />
      ) : null}
    </section>
  )
}

// ── Modals ───────────────────────────────────────────────────────────────────

function CreateSubscriptionModal({
  clientId: _clientId,
  onClose,
  onDone,
}: { clientId: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount]             = useState<string>('')
  const [interval, setInterval_]        = useState<'month' | 'year'>('month')
  const [description, setDescription]   = useState<string>('')
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState<string | null>(null)

  async function submit() {
    setError(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(cents) || cents < 50) {
      setError('Enter an amount of at least $0.50.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/clients/${_clientId}/billing`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:      'create_subscription',
          amount_cents: cents,
          interval,
          description: description || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Failed to create subscription')
        setSubmitting(false)
        return
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">Create subscription</h3>
        <p className="mt-1 text-xs text-gray-500">
          Stripe emails an invoice each cycle. Client clicks and pays. No card on file required.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-900">Amount</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="125.00"
                className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
              <select
                value={interval}
                onChange={(e) => setInterval_(e.target.value as 'month' | 'year')}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              >
                <option value="month">per month</option>
                <option value="year">per year</option>
              </select>
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">Description (optional)</span>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Managed Website — Professional"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-gray-500">Shows on the invoice and in your admin views.</span>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateInvoiceModal({
  clientId: _clientId,
  onClose,
  onDone,
}: { clientId: string; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount]           = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  async function submit() {
    setError(null)
    const cents = Math.round(parseFloat(amount) * 100)
    if (!Number.isFinite(cents) || cents < 50) {
      setError('Enter an amount of at least $0.50.')
      return
    }
    if (!description.trim()) {
      setError('Description is required.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/admin/clients/${_clientId}/billing`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:      'create_invoice',
          amount_cents: cents,
          description,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setError(json.error ?? 'Failed to send invoice')
        setSubmitting(false)
        return
      }
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-slate-900">Send one-time invoice</h3>
        <p className="mt-1 text-xs text-gray-500">
          Finalized and emailed to the client via Stripe. They pay through the hosted invoice link.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-900">Amount</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.50"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="450.00"
                className="w-40 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Setup fee — initial website build"
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-gray-500">Appears as the line item on the invoice.</span>
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Sending…' : 'Send invoice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
