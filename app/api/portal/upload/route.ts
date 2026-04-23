import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'

// Next.js 15: allow bigger bodies for image uploads (default is ~4 MB).
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
    if (role !== 'client' && role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized role' }, { status: 401 })
    }

    const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 403 })
    }

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[portal/upload] BLOB_READ_WRITE_TOKEN is not set on this environment')
      return NextResponse.json(
        { success: false, error: 'Blob storage is not configured. Contact support.' },
        { status: 500 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: `Only image files are allowed (JPEG, PNG, WebP, GIF, SVG). Got ${file.type || 'unknown'}.` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, error: `File size must be 5 MB or less (this file is ${(file.size / 1024 / 1024).toFixed(1)} MB).` },
        { status: 400 }
      )
    }

    // Scope every upload to the client's folder in Blob storage and
    // addRandomSuffix so two uploads of "hero.jpg" never collide. Without
    // this Vercel Blob returns "This blob already exists" and the whole
    // upload fails.
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100)
    const pathname = `clients/${client.id}/${safeName}`

    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.type,
    })

    return NextResponse.json({ success: true, data: { url: blob.url } })
  } catch (error) {
    console.error('[portal/upload] error:', error)
    const message = error instanceof Error ? error.message : 'Failed to upload file'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
