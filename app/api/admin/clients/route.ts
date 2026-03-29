import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ClientStatus = 'ACTIVE' | 'LEAD'

interface CreateClientBody {
  name?: string
  email?: string
  phone?: string
  contact_names?: string
  notes?: string
  status?: ClientStatus
}

export async function POST(request: Request) {
  try {
    const { sessionClaims } = await auth()
    const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role

    if (role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateClientBody
    const name = body.name?.trim() || null
    const email = body.email?.trim().toLowerCase() || null
    const phone = body.phone?.trim() || null
    const contactNames = body.contact_names?.trim() || null
    const notes = body.notes?.trim() || null
    const status: ClientStatus = body.status ?? 'ACTIVE'

    if (!['ACTIVE', 'LEAD'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }

    if (email && !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 })
    }

    if (email) {
      const existing = await db.client.findFirst({ where: { email }, select: { id: true } })
      if (existing) {
        return NextResponse.json({ success: false, error: 'A client with this email already exists' }, { status: 400 })
      }
    }

    const client = await db.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
        data: {
          name,
          email,
          phone,
          contact_names: contactNames,
          notes,
          status,
        },
      })

      // Future self-signup flow hook: self-registered clients will create a LEAD client
      // and a restricted client_config (for example, only page_request enabled).
      await tx.clientConfig.create({
        data: {
          client_id: createdClient.id,
        },
      })

      return createdClient
    })

    return NextResponse.json({ success: true, data: client })
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 })
  }
}
