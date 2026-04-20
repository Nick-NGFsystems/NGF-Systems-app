import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    clientId: string
  }>
}

interface ContentPayload {
  field_key?: string
  field_label?: string
  field_type?: string
  page_section?: string
  field_value?: string | null
}

const validFieldTypes = new Set(['text', 'richtext', 'image', 'url'])

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await context.params

    const fields = await db.siteContent.findMany({
      where: { client_id: clientId },
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: fields })
  } catch (error) {
    console.error('Get site content error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch content fields' }, { status: 500 })
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId } = await context.params
    const body = (await request.json()) as ContentPayload

    if (!body.field_key || !body.field_label || !body.field_type || !body.page_section) {
      return NextResponse.json({ success: false, error: 'field_key, field_label, field_type, and page_section are required' }, { status: 400 })
    }

    if (!validFieldTypes.has(body.field_type)) {
      return NextResponse.json({ success: false, error: 'Invalid field_type' }, { status: 400 })
    }

    const field = await db.siteContent.create({
      data: {
        client_id: clientId,
        field_key: body.field_key.trim(),
        field_label: body.field_label.trim(),
        field_type: body.field_type,
        page_section: body.page_section.trim(),
        field_value: body.field_value?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: field })
  } catch (error) {
    console.error('Create site content error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create content field' }, { status: 500 })
  }
}
