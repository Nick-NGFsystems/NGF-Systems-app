import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    id: string
  }>
}

interface UpdateInvoiceBody {
  title?: string
  client_id?: string | null
  amount?: number
  type?: string
  status?: string
  due_date?: string | null
  paid_date?: string | null
  notes?: string | null
}

async function isAdminRole() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await context.params

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'Invoice id is required' }, { status: 400 })
    }

    const body = (await request.json()) as UpdateInvoiceBody

    const normalizedTitle = body.title === undefined ? undefined : body.title.trim()
    const normalizedNotes =
      body.notes === undefined ? undefined : body.notes === null ? null : body.notes.trim()

    const invoice = await db.invoice.update({
      where: { id: invoiceId },
      data: {
        title: normalizedTitle,
        client_id: body.client_id ?? undefined,
        amount: typeof body.amount === 'number' ? body.amount : undefined,
        type: body.type,
        status: body.status,
        due_date: body.due_date ? new Date(body.due_date) : body.due_date === null ? null : undefined,
        paid_date: body.paid_date ? new Date(body.paid_date) : body.paid_date === null ? null : undefined,
        notes: normalizedNotes,
      },
    })

    return NextResponse.json({ success: true, data: invoice })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await isAdminRole()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: invoiceId } = await context.params

    if (!invoiceId) {
      return NextResponse.json({ success: false, error: 'Invoice id is required' }, { status: 400 })
    }

    await db.invoice.delete({
      where: { id: invoiceId },
    })

    return NextResponse.json({ success: true, data: { id: invoiceId } })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete invoice' }, { status: 500 })
  }
}
