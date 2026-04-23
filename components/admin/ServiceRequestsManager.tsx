'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface ServiceRequest {
  id: string
  name: string
  email: string
  phone: string
  bikeYear: string
  bikeMake: string
  bikeModel: string
  service: string
  description: string
  status: string
  bookingToken: string | null
  jobDuration: number | null
  notes: string | null
  createdAt: string
}

interface Props {
  requests: ServiceRequest[]
  clientId: string
  bookingUrl: string | null
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  followup: 'bg-blue-100 text-blue-800',
}

export default function ServiceRequestsManager({ requests, clientId, bookingUrl }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [jobDurations, setJobDurations] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('all')

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  async function updateRequest(requestId: string, status: string) {
    setLoading(requestId)
    try {
      const rawDuration = jobDurations[requestId]
      const parsedDuration = rawDuration ? parseInt(rawDuration, 10) : undefined
      const res = await fetch(`/api/admin/portal/${clientId}/service-requests`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          status,
          notes: notes[requestId],
          jobDuration: !isNaN(parsedDuration ?? NaN) ? parsedDuration : undefined,
        }),
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.error || 'Failed to update request')
      } else {
        router.refresh()
      }
    } catch {
      alert('Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-12 text-center">
        <p className="text-sm font-medium text-gray-900">No service requests yet</p>
        <p className="mt-1 text-sm text-gray-500">Requests submitted on the client website will appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {['all', 'pending', 'approved', 'declined', 'followup'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-blue-600 hover:text-blue-600'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {filtered.map((req) => (
        <div key={req.id} className="space-y-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-semibold text-slate-900">{req.name}</p>
              <p className="text-sm text-gray-500">
                {req.email} · {req.phone}
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusColors[req.status] ?? 'bg-gray-100 text-gray-800'}`}
            >
              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
            </span>
          </div>

          <div className="space-y-1 rounded-lg bg-gray-50 p-3 text-sm">
            <p>
              <span className="text-gray-500">Bike:</span> {req.bikeYear} {req.bikeMake} {req.bikeModel}
            </p>
            <p>
              <span className="text-gray-500">Service:</span> {req.service}
            </p>
            {req.description && (
              <p>
                <span className="text-gray-500">Description:</span> {req.description}
              </p>
            )}
            {req.jobDuration && (
              <p>
                <span className="text-gray-500">Est. duration:</span> {req.jobDuration} {req.jobDuration === 1 ? 'day' : 'days'}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Notes / Message to customer
            </label>
            <textarea
              value={notes[req.id] ?? req.notes ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
              rows={2}
              placeholder="Add a note visible to the customer..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-base focus:border-blue-600 focus:outline-none sm:text-sm"
            />
          </div>

          {req.status === 'pending' || req.status === 'followup' ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Estimated Duration (days) — shown to customer on booking page
                </label>
                <input
                  type="number"
                  min="1"
                  value={jobDurations[req.id] ?? (req.jobDuration !== null ? String(req.jobDuration) : '')}
                  onChange={(e) => setJobDurations((prev) => ({ ...prev, [req.id]: e.target.value }))}
                  placeholder="e.g. 2"
                  className="mt-1 w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2">
              <button
                onClick={() => updateRequest(req.id, 'approved')}
                disabled={loading === req.id}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading === req.id ? 'Processing...' : '✓ Approve & Send Booking Link'}
              </button>
              <button
                onClick={() => updateRequest(req.id, 'followup')}
                disabled={loading === req.id}
                className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:opacity-50"
              >
                Follow Up
              </button>
              <button
                onClick={() => updateRequest(req.id, 'declined')}
                disabled={loading === req.id}
                className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                Decline
              </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {req.status === 'approved' && req.bookingToken && bookingUrl && (
                <a
                  href={bookingUrl.replace('[token]', req.bookingToken)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline"
                >
                  View booking link →
                </a>
              )}
              <span className="text-sm text-gray-500">
                Submitted {new Date(req.createdAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
