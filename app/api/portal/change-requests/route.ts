import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const client = await db.client.findUnique({ where: { clerk_user_id: userId } })
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    const { title, description, page_section, priority } = await request.json() as { title: string; description: string; page_section?: string; priority?: string }
    if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const record = await db.changeRequest.create({
      data: { client_id: client.id, title: title.trim(), description: description?.trim() || null, page_section: page_section?.trim() || null, priority: (priority as 'LOW' | 'MEDIUM' | 'URGENT') || 'MEDIUM', status: 'PENDING' },
    })
    return NextResponse.json({ success: true, data: record })
  } catch (err) {
    console.error('[portal/change-requests POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
