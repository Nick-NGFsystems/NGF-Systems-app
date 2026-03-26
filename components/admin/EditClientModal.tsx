'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

interface EditClientModalProps {
  clientId: string
  currentName: string
  currentEmail: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

export default function EditClientModal({ clientId, currentName, currentEmail }: EditClientModalProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(currentName)
  const [email, setEmail] = useState(currentEmail)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const closeModal = () => {
    setIsOpen(false)
    setName(currentName)
    setEmail(currentEmail)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Unable to update client')
        setIsSubmitting(false)
        return
      }

      setIsOpen(false)
      router.refresh()
    } catch {
      setError('Unable to update client')
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="h-9 rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
      >
        Edit
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Edit Client</h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="edit-client-name" className="text-sm font-medium text-gray-700">
                  Name
                </label>
                <input
                  id="edit-client-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="edit-client-email" className="text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="edit-client-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  required
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
                  {isSubmitting ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
