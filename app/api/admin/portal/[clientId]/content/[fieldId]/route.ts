import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    clientId: string
    fieldId: string
  }>
}

interface ContentUpdatePayload {
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, fieldId } = await context.params

    const existing = await db.siteContent.findUnique({ where: { id: fieldId } })
    if (!existing || existing.client_id !== clientId) {
      return NextResponse.json({ success: false, error: 'Content field not found' }, { status: 404 })
    }

    const body = (await request.json()) as ContentUpdatePayload

    if (body.field_type && !validFieldTypes.has(body.field_type)) {
      return NextResponse.json({ success: false, error: 'Invalid field_type' }, { status: 400 })
    }

    const updated = await db.siteContent.update({
      where: { id: fieldId },
      data: {
        ...(body.field_key !== undefined && { field_key: body.field_key.trim() }),
        ...(body.field_label !== undefined && { field_label: body.field_label.trim() }),
        ...(body.field_type !== undefined && { field_type: body.field_type }),
        ...(body.page_section !== undefined && { page_section: body.page_section.trim() }),
        ...(body.field_value !== undefined && { field_value: body.field_value?.trim() || null }),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update site content error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update content field' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { clientId, fieldId } = await context.params

    const existing = await db.siteContent.findUnique({ where: { id: fieldId } })
    if (!existing || existing.client_id !== clientId) {
      return NextResponse.json({ success: false, error: 'Content field not found' }, { status: 404 })
    }

    await db.siteContent.delete({ where: { id: fieldId } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete site content error:', error)
    return NextResponse.json({ success: false, error: 'Failed to delete content field' }, { status: 500 })
  }
}
