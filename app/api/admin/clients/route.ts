import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

type ClientStatus = 'ACTIVE' | 'LEAD'

interface CreateClientBody {
  name?: string
  email?: string
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
    const name = body.name?.trim()
    const email = body.email?.trim().toLowerCase()
    const status: ClientStatus = body.status ?? 'ACTIVE'

    if (!name || !email) {
      return NextResponse.json({ success: false, error: 'Name and email are required' }, { status: 400 })
    }

    if (!['ACTIVE', 'LEAD'].includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid status value' }, { status: 400 })
    }

    const client = await db.$transaction(async (tx) => {
      const createdClient = await tx.client.create({
        data: {
          name,
          email,
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
    const message = error instanceof Error ? error.message : 'Failed to create client'

    if (message.includes('Unique constraint failed')) {
      return NextResponse.json({ success: false, error: 'A client with this email already exists' }, { status: 400 })
    }

    return NextResponse.json({ success: false, error: 'Failed to create client' }, { status: 500 })
  }
}
