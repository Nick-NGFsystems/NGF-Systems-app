'use client'

import { useState } from 'react'

type Props = { clientId: string; clientName: string }

export default function ResetWebsiteContentButton({ clientId, clientName }: Props) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<null | 'ok' | 'err'>(null)

  async function handleReset() {
    const confirmed = window.confirm(
      `Wipe ALL website content (published + draft) for "${clientName}"?\n\n` +
      `The client's site will fall back to its hardcoded defaults until you publish ` +
      `new content from the editor. This cannot be undone.`
    )
    if (!confirmed) return

    setBusy(true)
    setDone(null)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/website-content`, {
        method: 'DELETE',
      })
      setDone(res.ok ? 'ok' : 'err')
    } catch {
      setDone('err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-red-100 bg-red-50/40 p-4">
      <h3 className="text-sm font-semibold text-red-900">Reset Website Content</h3>
      <p className="mt-1 text-xs text-red-800/80 leading-relaxed">
        Deletes the client's published content and any pending draft. The live site will
        render hardcoded defaults from its source code. Use when content got corrupted
        or cross-contaminated and you want to start fresh from the live site.
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="inline-flex h-9 items-center rounded-lg border border-red-300 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
        >
          {busy ? 'Resetting…' : 'Reset Website Content'}
        </button>
        {done === 'ok' && <span className="text-xs text-green-700">Done — content cleared.</span>}
        {done === 'err' && <span className="text-xs text-red-700">Failed — check logs.</span>}
      </div>
    </div>
  )
}
