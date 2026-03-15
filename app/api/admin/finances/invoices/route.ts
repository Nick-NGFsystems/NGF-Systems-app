import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface CreateInvoiceBody {
  title?: string
  client_id?: string | null
  amount?: number
  type?: string
  status?: string
  due_date?: string | null
  notes?: string | null
}

async function isAdminRole() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET() {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const invoices = await db.invoice.findMany({
      orderBy: { created: 'desc' },
    })

    return NextResponse.json({ success: true, data: invoices })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to load invoices' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateInvoiceBody

    const title = body.title?.trim()
    const amount = Number(body.amount)

    if (!title || Number.isNaN(amount)) {
      return NextResponse.json({ success: false, error: 'Title and amount are required' }, { status: 400 })
    }

    const invoice = await db.invoice.create({
      data: {
        title,
        client_id: body.client_id || null,
        amount,
        type: body.type ?? 'ONE_TIME',
        status: body.status ?? 'PENDING',
        due_date: body.due_date ? new Date(body.due_date) : null,
        notes: body.notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: invoice })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create invoice' }, { status: 500 })
  }
}
