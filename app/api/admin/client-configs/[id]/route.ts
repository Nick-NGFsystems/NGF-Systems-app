import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface UpdateConfigBody {
  page_request?: boolean
  page_website?: boolean
  page_content?: boolean
  page_invoices?: boolean
  feature_blog?: boolean
  feature_products?: boolean
  feature_booking?: boolean
  feature_gallery?: boolean
  booking_url?: string | null
  database_url?: string | null
  site_url?: string | null
  site_repo?: string | null
}

const BOOLEAN_FIELDS = [
  'page_request',
  'page_website',
  'page_content',
  'page_invoices',
  'feature_blog',
  'feature_products',
  'feature_booking',
  'feature_gallery',
] as const

const STRING_FIELDS = ['booking_url', 'database_url', 'site_url', 'site_repo'] as const

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: configId } = await context.params

    if (!configId) {
      return NextResponse.json({ success: false, error: 'Config id is required' }, { status: 400 })
    }

    const body = (await request.json()) as UpdateConfigBody

    const data: Partial<UpdateConfigBody> = {}

    for (const field of BOOLEAN_FIELDS) {
      if (typeof body[field] === 'boolean') {
        data[field] = body[field]
      }
    }

    for (const field of STRING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, field)) {
        const value = body[field]

        if (typeof value === 'string') {
          data[field] = value.trim() || null
        } else if (value === null) {
          data[field] = null
        }
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ success: false, error: 'No valid fields provided' }, { status: 400 })
    }

    const existing = await db.clientConfig.findUnique({
      where: { id: configId },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Config not found' }, { status: 404 })
    }

    const updated = await db.clientConfig.update({
      where: { id: configId },
      data,
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('Update client config error:', error)
    return NextResponse.json({ success: false, error: 'Failed to update config' }, { status: 500 })
  }
}
