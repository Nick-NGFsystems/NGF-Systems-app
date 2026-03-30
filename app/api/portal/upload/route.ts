import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { put } from '@vercel/blob'

async function validateClient() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'client'
}

export async function POST(request: Request) {
  try {
    const isClient = await validateClient()
    if (!isClient) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'File is required' }, { status: 400 })
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
