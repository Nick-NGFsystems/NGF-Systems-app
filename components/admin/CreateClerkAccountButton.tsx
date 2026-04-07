'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface CreateClerkAccountButtonProps {
  clientId: string
  clientEmail?: string | null
}

interface ApiResponse {
  success: boolean
  error?: string
  message?: string
  temporaryPassword?: string
}

export default function CreateClerkAccountButton({
  clientId,
  clientEmail,
}: CreateClerkAccountButtonProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [sendSetupEmail, setSendSetupEmail] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  const closeModal = () => {
    const shouldRefresh = Boolean(successMessage)
    setIsOpen(false)
    setSendSetupEmail(false)
    setIsSubmitting(false)
    setError(null)
    setSuccessMessage(null)
    setTemporaryPassword(null)

    if (shouldRefresh) {
      router.refresh()
    }
  }

  const handleCreate = async () => {
    if (!clientEmail) {
      setError('Client must have an email address before creating a Clerk account')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessMessage(null)
    setTemporaryPassword(null)

    try {
      const response = await fetch(`/api/admin/clients/${clientId}/create-clerk-account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ send_setup_email: sendSetupEmail }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Failed to create Clerk account')
        return
      }

      setSuccessMessage(result.message ?? 'Clerk account created successfully')
      setTemporaryPassword(result.temporaryPassword ?? null)
    } catch {
      setError('Failed to create Clerk account')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-11 items-center rounded-lg border border-blue-200 bg-white px-4 text-sm font-medium text-blue-600 transition hover:bg-blue-50"
      >
        Create Clerk Account
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h2 className="font-sans text-xl font-semibold tracking-tight text-slate-900">
                Create Clerk Account
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                <p>
                  <span className="font-medium text-gray-900">Client email:</span> {clientEmail ?? 'No email on file'}
                </p>
              </div>

              <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3">
                <input
                  type="checkbox"
                  checked={sendSetupEmail}
                  onChange={(event) => setSendSetupEmail(event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-700">Send setup email to client</span>
                  <span className="block text-xs text-gray-500">
                    If off, a temporary password will be returned here for the admin to share manually.
                  </span>
                </span>
              </label>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {successMessage && (
                <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-700">{successMessage}</p>
                  {temporaryPassword && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                        Temporary Password
                      </p>
                      <p className="mt-1 rounded-md bg-white px-3 py-2 font-mono text-sm text-slate-900 break-all">
                        {temporaryPassword}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  {successMessage ? 'Done' : 'Cancel'}
                </button>
                {!successMessage && (
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={isSubmitting}
                    className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Account'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
