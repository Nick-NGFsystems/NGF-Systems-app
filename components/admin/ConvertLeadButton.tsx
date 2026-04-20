'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ConvertLeadButtonProps {
  clientId: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

export default function ConvertLeadButton({ clientId }: ConvertLeadButtonProps) {
  const router = useRouter()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConvert = async () => {
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Unable to convert lead')
        setIsSaving(false)
        return
      }

      router.push(`/admin/clients/${clientId}`)
      router.refresh()
    } catch {
      setError('Unable to convert lead')
      setIsSaving(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-1 sm:w-auto">
      <button
        type="button"
        onClick={handleConvert}
        disabled={isSaving}
        className="flex h-10 w-full items-center justify-center whitespace-nowrap rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-auto sm:px-3 sm:text-xs"
      >
        {isSaving ? 'Converting...' : 'Convert to Client'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
