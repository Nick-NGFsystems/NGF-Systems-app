'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CLIENT_STATUSES, type ClientStatus } from '@/lib/client-status'

interface ClientStatusSelectProps {
  clientId: string
  currentStatus: string
}

interface ApiResponse {
  success: boolean
  error?: string
}

export default function ClientStatusSelect({ clientId, currentStatus }: ClientStatusSelectProps) {
  const router = useRouter()
  const [status, setStatus] = useState(currentStatus)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const options = useMemo(() => {
    if (CLIENT_STATUSES.includes(currentStatus as ClientStatus)) {
      return CLIENT_STATUSES
    }

    return [currentStatus as ClientStatus, ...CLIENT_STATUSES]
  }, [currentStatus])

  const handleStatusChange = async (nextStatus: string) => {
    setStatus(nextStatus)
    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/clients/${clientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setError(result.error ?? 'Unable to update status')
        setStatus(currentStatus)
        setIsSaving(false)
        return
      }

      setIsSaving(false)
      router.refresh()
    } catch {
      setError('Unable to update status')
      setStatus(currentStatus)
      setIsSaving(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <select
        value={status}
        onChange={(event) => handleStatusChange(event.target.value)}
        disabled={isSaving}
        className="h-9 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 outline-none transition focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
