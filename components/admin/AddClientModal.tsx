'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

type ClientStatus = 'ACTIVE' | 'LEAD'

interface AddClientModalProps {
  defaultStatus?: ClientStatus
  buttonLabel?: string
  modalTitle?: string
}

interface ApiResponse {
  success: boolean
  error?: string
  message?: string
}

export default function AddClientModal({
  defaultStatus = 'ACTIVE',
  buttonLabel = 'Add Client',
  modalTitle = 'Add Client',
}: AddClientModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [contactNames, setContactNames] = useState('')
  const [notes, setNotes] = useState('')
  const [sendSetupEmail, setSendSetupEmail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeModal = () => {
    setIsOpen(false)
    setName('')
    setEmail('')
    setPhone('')
    setContactNames('')
    setNotes('')
    setSendSetupEmail(false)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    if (sendSetupEmail && !email.trim()) {
      setError('Email is required to send a setup email')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          contact_names: contactNames,
          notes,
          status: defaultStatus,
          send_setup_email: sendSetupEmail,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Unable to save')
        return
      }

      closeModal()
      router.refresh()
    } catch {
      setError('Unable to save')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        {buttonLabel}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">{modalTitle}</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <p className="mt-3 text-sm text-gray-500">
              Add whatever info you have now — the rest can be filled in later.
            </p>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="client-name" className="text-sm font-medium text-gray-700">
                  Name (optional)
                </label>
                <input
                  id="client-name"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-base text-gray-900 outline-none transition focus:border-blue-600 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="client-email" className="text-sm font-medium text-gray-700">
                  Email (optional — only needed for portal login)
                </label>
                <input
                  id="client-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-base text-gray-900 outline-none transition focus:border-blue-600 sm:text-sm"
                />
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={sendSetupEmail}
                  onChange={(event) => setSendSetupEmail(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">Send setup email now</span>
                  <span className="block text-xs text-gray-500">
                    Off by default. Turn on only when you want Clerk to email the client account setup invite.
                  </span>
                </span>
              </label>

              <div>
                <label htmlFor="client-phone" className="text-sm font-medium text-gray-700">
                  Phone (optional)
                </label>
                <input
                  id="client-phone"
                  type="text"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-base text-gray-900 outline-none transition focus:border-blue-600 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="client-contacts" className="text-sm font-medium text-gray-700">
                  Names of People (optional)
                </label>
                <input
                  id="client-contacts"
                  type="text"
                  value={contactNames}
                  onChange={(event) => setContactNames(event.target.value)}
                  placeholder="e.g. Jane Doe, John Smith"
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-base text-gray-900 outline-none transition focus:border-blue-600 sm:text-sm"
                />
              </div>

              <div>
                <label htmlFor="client-notes" className="text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  id="client-notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-base text-gray-900 outline-none transition focus:border-blue-600 sm:text-sm"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? 'Saving...' : defaultStatus === 'LEAD' ? 'Create Lead' : 'Create Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
