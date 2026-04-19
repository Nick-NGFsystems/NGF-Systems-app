import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function GET() {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const entries = await db.timeEntry.findMany({
      orderBy: { created: 'desc' },
    })

    // Resolve client and project names separately (no FK relations in schema)
    const clientIds = [...new Set(entries.map(e => e.client_id).filter(Boolean))]
    const projectIds = [...new Set(entries.map(e => e.project_id).filter(Boolean))] as string[]

    const [clients, projects] = await Promise.all([
      clientIds.length > 0
        ? db.client.findMany({ where: { id: { in: clientIds } }, select: { id: true, name: true, business: true } })
        : [],
      projectIds.length > 0
        ? db.project.findMany({ where: { id: { in: projectIds } }, select: { id: true, name: true } })
        : [],
    ])

    const clientMap = Object.fromEntries(clients.map(c => [c.id, c]))
    const projectMap = Object.fromEntries(projects.map(p => [p.id, p]))

    const enriched = entries.map(e => ({
      ...e,
      client: clientMap[e.client_id] ?? null,
      project: e.project_id ? (projectMap[e.project_id] ?? null) : null,
    }))

    return NextResponse.json({ success: true, data: enriched })
  } catch (error) {
    console.error('Get time entries error:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch time entries' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json() as {
      client_id?: string
      project_id?: string | null
      hours?: number
      notes?: string | null
    }

    if (!body.client_id) {
      return NextResponse.json({ success: false, error: 'Client is required' }, { status: 400 })
    }

    const hours = parseFloat(String(body.hours ?? ''))
    if (!Number.isFinite(hours) || hours <= 0) {
      return NextResponse.json({ success: false, error: 'Hours must be a positive number' }, { status: 400 })
    }

    const entry = await db.timeEntry.create({
      data: {
        client_id: body.client_id,
        project_id: body.project_id || null,
        hours,
        notes: body.notes?.trim() || null,
      },
    })

    return NextResponse.json({ success: true, data: entry })
  } catch (error) {
    console.error('Create time entry error:', error)
    return NextResponse.json({ success: false, error: 'Failed to create time entry' }, { status: 500 })
  }
}
