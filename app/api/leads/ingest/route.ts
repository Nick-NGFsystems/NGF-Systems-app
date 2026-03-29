import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // Validate shared secret
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.LEADS_API_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, business, intent } = await req.json()

    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 })
    }

    // Check if client with this email already exists
    const existing = await db.client.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ success: true, data: existing, message: 'Lead already exists' })
    }

    // Create client record with LEAD status
    const client = await db.client.create({
      data: {
        name,
        email,
        business: business ?? null,
        intent: intent ?? null,
        status: 'LEAD',
        config: {
          create: {
            page_request: true,
          },
        },
      },
      include: { config: true },
    })

    return NextResponse.json({ success: true, data: client })
  } catch (error) {
    console.error('Lead ingest error:', error)
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
  }
}
