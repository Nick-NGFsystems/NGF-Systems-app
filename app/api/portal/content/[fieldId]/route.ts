import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

interface RouteContext {
  params: Promise<{
    fieldId: string
  }>
}

interface UpdatePayload {
  field_value?: string | null
}

async function validateClient() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'client'
}

async function getClientIdFromSession() {
  const { userId } = await auth()
  if (!userId) return null

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

  return client?.id ?? null
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isClient = await validateClient()
    if (!isClient) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const clientId = await getClientIdFromSession()
    if (!clientId) {
      return NextResponse.json({ success: false, error: 'Client record not found' }, { status: 404 })
    }

    const { fieldId } = await context.params

    const field = await db.siteContent.findUnique({ where: { id: fieldId } })
    if (!field || field.client_id !== clientId) {
      return NextResponse.json({ success: false, error: 'Content field not found' }, { status: 404 })
    }

    const body = (await request.json()) as UpdatePayload

    const updated = await db.siteContent.update({
      where: { id: fieldId },
      data: {
        ...(body.fi