import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

/**
 * GET  /api/portal/website/versions       — list recent publishes for the caller's client
 * POST /api/portal/website/versions       — revert to { versionId } (promotes that snapshot)
 *
 * The caller is identified entirely via Clerk session (`clerk_user_id`) — we
 * never accept a client_id from the request body. That prevents client A from
 * reading or modifying client B's history.
 */

function isAllowedRole(role: unknown) {
  return role === 'client' || role === 'admin'
}

async function getCallerClient() {
  const { userId, sessionClaims } = await auth()
  if (!userId) return { error: 'Unauthorized', status: 401 as const }
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  if (!isAllowedRole(role)) return { error: 'Unauthorized', status: 401 as const }

  const client = await db.client.findUnique({
    where:  { clerk_user_id: userId },
    select: { id: true },
  })
  if (!client) return { error: 'Client not found', status: 404 as const }
  return { clientId: client.id }
}

export async function GET() {
  const res = await getCallerClient()
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const versions = await db.websiteContentVersion.findMany({
    where:   { client_id: res.clientId },
    orderBy: { published_at: 'desc' },
    take:    20,
    select:  { id: true, published_at: true, note: true },
  })
  return NextResponse.json({ versions })
}

export async function POST(request: Request) {
  const res = await getCallerClient()
  if ('error' in res) return NextResponse.json({ error: res.error }, { status: res.status })

  const body = (await request.json().catch(() => null)) as { versionId?: string } | null
  if (!body?.versionId) {
    return NextResponse.json({ error: 'versionId is required' }, { status: 400 })
  }

  // Fetch the target version, scoped to this client (prevents IDOR).
  const target = await db.websiteContentVersion.findFirst({
    where: { id: body.versionId, client_id: res.clientId },
  })
  if (!target) return NextResponse.json({ error: 'Version not found' }, { status: 404 })

  // Snapshot the CURRENT published content first so the revert itself is recoverable.
  const current = await db.websiteContent.findUnique({
    where: { client_id: res.clientId },
  })
  if (current?.content) {
    try {
      await db.websiteContentVersion.create({
        data: {
          client_id: res.clientId,
          content:   current.content as object,
          note:      'Auto-snapshot before revert',
        },
      })
    } catch {
      // Non-fatal — user can still revert even if snapshot fails.
    }
  }

  // Promote the target snapshot to live content and clear any in-progress draft.
  await db.websiteContent.upsert({
    where:  { client_id: res.clientId },
    update: {
      content:       target.content as object,
      draft_content: null,
      published_at:  new Date(),
    },
    create: {
      client_id:    res.clientId,
      content:      target.content as object,
      published_at: new Date(),
    },
  })

  return NextResponse.json({ success: true, reverted_to: target.id })
}
