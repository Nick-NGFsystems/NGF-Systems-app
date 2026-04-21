'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type FormState = 'idle' | 'loading' | 'success' | 'error'

export default function ChangeRequestForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pageSection, setPageSection] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [state, setState] = useState<FormState>('idle')
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!title.trim()) { setError('Please enter a title.'); return }
    if (!description.trim()) { setError('Please describe what you need.'); return }
    setState('loading'); setError('')
    try {
      const res = await fetch('/api/portal/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, page_section: pageSection, priority }),
      })
      if (!res.ok) throw new Error('Failed')
      setState('success')
      setTimeout(() => { setOpen(false); setState('idle'); setTitle(''); setDescription(''); setPageSection(''); setPriority('MEDIUM'); router.refresh() }, 1500)
    } catch { setState('error'); setError('Something went wrong. Please try again.') }
  }

  const close = () => { setOpen(false); setState('idle'); setError('') }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700">
        + Submit Change Request
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-lg text-slate-900">Submit a Change Request</h2>
              <button onClick={close} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            {state === 'success' ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-3">&#x2705;</div>
                <p className="font-semibold text-gray-900">Request submitted!</p>
                <p className="text-sm text-gray-500 mt-1">We will review it and get back to you soon.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">What needs changing? <span className="text-red-500">*</span></label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Update my business hours" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-red-500">*</span></label>
                  <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe exactly what you would like changed..." className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Page / Section</label>
                    <input type="text" value={pageSection} onChange={e => setPageSection(e.target.value)} placeholder="e.g. Homepage, About page" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="LOW">Low &mdash; whenever you can</option>
                      <option value="MEDIUM">Medium &mdash; this week</option>
                      <option value="URGENT">Urgent &mdash; ASAP</option>
                    </select>
                  </div>
                </div>
                {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <button onClick={close} className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={handleSubmit} disabled={state === 'loading'} className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition">
                    {state === 'loading' ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
