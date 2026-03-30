'use client'

import { useState } from 'react'

interface PortalRequestFormProps {
  maxImages?: number
}

export default function PortalRequestForm({ maxImages = 3 }: PortalRequestFormProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [pageSection, setPageSection] = useState('')
  const [priority, setPriority] = useState('MEDIUM')
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleImageSelection(files: FileList | null) {
    if (!files || files.length === 0) return

    const remaining = maxImages - imageUrls.length
    if (remaining <= 0) {
      setError(`You can upload up to ${maxImages} images.`)
      return
    }

    setError(null)
    setMessage(null)
    setIsUploading(true)

    try {
      const selected = Array.from(files).slice(0, remaining)
      const uploaded: string[] = []

      for (const file of selected) {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch('/api/portal/upload', {
          method: 'POST',
          body: formData,
        })

        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to upload image')
        }

        uploaded.push(result.data.url)
      }

      setImageUrls((prev) => [...prev, ...uploaded])
      setMessage('Images uploaded')
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  function removeImage(url: string) {
    setImageUrls((prev) => prev.filter((item) => item !== url))
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setMessage(null)
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/portal/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          page_section: pageSection,
          priority,
          image_urls: imageUrls,
        }),
      })

      const result = await response.json()
      if (!response.ok || !result.success) {
        setError(result.error || 'Failed to submit request')
        return
      }

      setTitle('')
      setDescription('')
      setPageSection('')
      setPriority('MEDIUM')
      setImageUrls([])
      setMessage('Request submitted successfully')
    } catch {
      setError('Failed to submit request')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={submitRequest} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700">Title</label>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="What needs to change?"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={4}
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          placeholder="Describe the update in detail"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700">Page Section</label>
          <input
            type="text"
            value={pageSection}
            onChange={(event) => setPageSection(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
            placeholder="homepage hero"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Priority</label>
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
            className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="URGENT">URGENT</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Images (up to 3)</label>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => void handleImageSelection(event.target.files)}
          className="mt-1 block w-full text-sm text-gray-600"
        />
        {isUploading && <p className="mt-2 text-sm text-gray-500">Uploading images...</p>}
        {imageUrls.length > 0 && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {imageUrls.map((url) => (
              <div key={url} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                <img src={url} alt="Uploaded request" className="h-28 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(url)}
                  className="w-full border-t border-gray-200 px-2 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {message && <p className="text-sm text-green-700">{message}</p>}

      <button
        type="submit"
        disabled={isSubmitting || isUploading}
        className="inline-flex h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
      >
        {isSubmitting ? 'Submitting...' : 'Submit Request'}
      </button>
    </form>
  )
}
