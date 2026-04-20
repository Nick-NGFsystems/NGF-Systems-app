import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { db } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
    if (!client) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
    const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ success: false, error: 'Only image files are allowed (JPEG, PNG, WebP, GIF, SVG)' }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ success: false, error: 'File size must be 5MB or less' }, { status: 400 })
    }

    const blob = await put(file.name, file, {
      access: 'public',
    })

    return NextResponse.json({ success: true, data: { url: blob.url } })
  } catch (error) {
    console.error('Portal upload error:', error)
    return NextResponse.json({ success: false, error: 'Failed to upload file' }, { status: 500 })
  }
}
