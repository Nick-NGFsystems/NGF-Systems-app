import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    // Validate shared secret
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.LEADS_API_SECRET) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { name, email, phone, contact_names, business, intent, notes } = await req.json()

    const normalizedName = typeof name === 'string' ? name.trim() : ''
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
    const normalizedPhone = typeof phone === 'string' ? phone.trim() : ''
    const normalizedContactNames = typeof contact_names === 'string' ? contact_names.trim() : ''
    const normalizedBusiness = typeof business === 'string' ? business.trim() : ''
    const normalizedIntent = typeof intent === 'string' ? intent.trim() : ''
    const normalizedNotes = typeof notes === 'string' ? notes.trim() : ''

    if (normalizedEmail) {
      const existing = await db.client.findFirst({ where: { email: normalizedEmail } })
      if (existing) {
        return NextResponse.json({ success: true, data: existing, message: 'Lead already exists' })
      }
    }

    // Create client record with LEAD status
    const client = await db.client.create({
      data: {
        name: normalizedName || null,
        email: normalizedEmail || null,
        phone: normalizedPhone || null,
        contact_names: normalizedContactNames || null,
        business: normalizedBusiness || null,
        intent: normalizedIntent || null,
        notes: normalizedNotes || null,
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
