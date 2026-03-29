import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PROJECT_STATUSES = ['PENDING', 'IN_PROGRESS', 'ACTIVE', 'COMPLETED', 'ON_HOLD'] as const

type ProjectStatus = (typeof PROJECT_STATUSES)[number]

interface CreateProjectBody {
  client_id?: string
  name?: string
  status?: string
}

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

    const projects = await db.project.findMany({
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: {
          orderBy: {
            created: 'desc',
          },
        },
      },
      orderBy: {
        created: 'desc',
      },
    })

    return NextResponse.json({ success: true, data: projects })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as CreateProjectBody
    const clientId = body.client_id?.trim()
    const name = body.name?.trim()
    const status = (body.status?.trim().toUpperCase() ?? 'PENDING') as ProjectStatus

    if (!clientId || !name) {
      return NextResponse.json({ success: false, error: 'Client and project name are required' }, { status: 400 })
    }

    if (!PROJECT_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid project status' }, { status: 400 })
    }

    const clientExists = await db.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    })

    if (!clientExists) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
    }

    const project = await db.project.create({
      data: {
        client_id: clientId,
        name,
        status,
      },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tasks: true,
      },
    })

    return NextResponse.json({ success: true, data: project })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create project' }, { status: 500 })
  }
}
