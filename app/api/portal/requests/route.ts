import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RequestPayload {
  title?: string
  description?: string | null
  page_section?: string | null
  priority?: string
  image_urls?: string[]
}

const validPriority = new Set(['LOW', 'MEDIUM', 'URGENT'])

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    let client = await db.client.findUnique({ where: { clerk_user_id: userId } })

    if (!client) {
      const user = await currentUser()
      const email = user?.emailAddresses[0]?.emailAddress
      if (email) {
        client = await db.client.findUnique({ where: { email } })
        if (client) {
          await db.client.update({
            where: { id: client.id },
            data: { clerk_user_id: userId },
          })
        }
      }
    }

    if (!client) {
      return NextResponse.json({ success: false, error: 'Client record not found' }, { status: 404 })
    }

    const body = (await request.json()) as RequestPayload

    if (!body.title) {
      return NextResponse.json({ success: false, error: 'Title is required' }, { status: 400 })
    }

    const priority = body.priority || 'MEDIUM'
    if (!validPriority.has(priority)) {
      return NextResponse.json({ success: false, error: 'Invalid priority' }, { status: 400 })
    }

    const record = await db.changeRequest.create({
      data: {
        client_id: client.id,
        title: body.title.trim(),
        description: body.description?.trim() || null,
        page_section: body.page_section?.trim() || null,
        priority,
        status: 'PENDING',
        image_urls: body.image_urls && body.image_urls.length > 0 ? body.image_urls.join(',') : null,
      },
    })

    return NextResponse.json({ success: true, data: record })
  } catch (error) {
    console.error('Create portal request error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create request' }, { status: 500 })
  }
}
