'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useConfirm } from '@/hooks/useConfirm'

interface DeleteClientButtonProps {
  clientId: string
  clientName: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

export default function DeleteClientButton({ clientId, clientName }: DeleteClientButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm()

  const handleDelete = async () => {
    const confirmed = await confirm(`Delete ${clientName}? This action cannot be undone.`)

    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Failed to delete client')
        setIsDeleting(false)
        return
      }

      router.refresh()
    } catch {
      setError('Failed to delete client')
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto">
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
      <button
        type="button"
        onClick={handleDelete}
        disabled={isDeleting}
        className="w-full text-sm font-medium text-red-600 transition hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {isDeleting ? 'Deleting...' : 'Delete'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
