'use client'

import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useConfirm } from '@/hooks/useConfirm'

interface Client {
  id: string
  name: string | null
  business: string | null
}

interface Project {
  id: string
  name: string
  client_id: string | null
}

interface TimeEntry {
  id: string
  client_id: string
  project_id: string | null
  hours: number
  notes: string | null
  created: Date
  client: Client | null
  project: Project | null
}

interface Props {
  initialEntries: TimeEntry[]
  clients: Client[]
  projects: Project[]
}

export default function TimeTracker({ initialEntries, clients, projects }: Props) {
  const [entries, setEntries] = useState<TimeEntry[]>(initialEntries)
  const [clientId, setClientId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [hours, setHours] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()

  // Computed stats — derived from live entries state so they stay in sync
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0)
  const monthlyHours = entries
    .filter(e => new Date(e.created) >= monthStart)
    .reduce((sum, e) => sum + e.hours, 0)

  // Filter projects by selected client
  const filteredProjects = clientId
    ? projects.filter(p => p.client_id === clientId)
    : projects

  function clientLabel(c: Client) {
    return c.business || c.name || c.id
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!clientId) { setError('Please select a client.'); return }
    const h = parseFloat(hours)
    if (!Number.isFinite(h) || h <= 0) { setError('Enter a valid number of hours.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, project_id: projectId || null, hours: h, notes: notes.trim() || null }),
      })
      const result = await res.json() as { success: boolean; data?: TimeEntry; error?: string }
      if (!res.ok || !result.success) { setError(result.error ?? 'Failed to save entry'); return }

      // Resolve names client-side for instant UI update
      const newEntry: TimeEntry = {
        ...result.data!,
        client: clients.find(c => c.id === clientId) ?? null,
        project: projectId ? (projects.find(p => p.id === projectId) ?? null) : null,
      }

      setEntries(prev => [newEntry, ...prev])
      setHours('')
      setNotes('')
      setProjectId('')
    } catch {
      setError('Failed to save entry')
    } finally {
      setSaving(false)
    }
  }

  async function deleteEntry(id: string) {
    if (!await confirm('Delete this time entry?')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/admin/time-entries/${id}`, { method: 'DELETE' })
      if (res.ok) setEntries(prev => prev.filter(e => e.id !== id))
    } catch {
      // no-op
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Live stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          { label: 'Total Hours', value: totalHours.toFixed(1) },
          { label: 'This Month', value: monthlyHours.toFixed(1) },
          { label: 'Entries', value: entries.length.toString() },
        ].map(card => (
          <div key={card.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{card.label}</p>
            <p className="mt-2 font-sans text-3xl font-semibold tracking-tight text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Log form */}
      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="font-sans text-base font-semibold text-gray-900 mb-4">Log Time</h2>
        <form onSubmit={addEntry} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Client <span className="text-red-500">*</span></label>
            <select
              value={clientId}
              onChange={e => { setClientId(e.target.value); setProjectId('') }}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select client…</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{clientLabel(c)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">No project</option>
              {filteredProjects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hours <span className="text-red-500">*</span></label>
            <input
              type="number"
              step="0.25"
              min="0.25"
              value={hours}
              onChange={e => setHours(e.target.value)}
              placeholder="e.g. 1.5"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on?"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-10 items-center rounded-lg bg-slate-900 px-5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Log Time'}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        </form>
      </section>

      {/* Entries table */}
      <section className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-sans text-base font-semibold text-gray-900">Entries</h2>
          <span className="text-sm text-gray-500">{totalHours.toFixed(1)} hrs total</span>
        </div>

        {entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-gray-400">No time entries yet. Log your first entry above.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {entries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-gray-50 transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {entry.client ? clientLabel(entry.client) : entry.client_id}
                    </span>
                    {entry.project && (
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {entry.project.name}
                      </span>
                    )}
                  </div>
                  {entry.notes && <p className="mt-0.5 text-xs text-gray-500 truncate">{entry.notes}</p>}
                  <p className="mt-0.5 text-xs text-gray-400">
                    {new Date(entry.created).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className="font-semibold text-slate-900 tabular-nums">
                    {entry.hours % 1 === 0 ? entry.hours.toFixed(0) : entry.hours.toFixed(2)}h
                  </span>
                  <button
                    onClick={() => void deleteEntry(entry.id)}
                    disabled={deletingId === entry.id}
                    className="text-xs text-red-600 hover:text-red-800 disabled:opacity-40 transition"
                  >
                    {deletingId === entry.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
