import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const PROJECT_STATUSES = ['PENDING', 'IN_PROGRESS', 'ACTIVE', 'COMPLETED', 'ON_HOLD'] as const

type ProjectStatus = (typeof PROJECT_STATUSES)[number]

interface RouteContext {
  params: Promise<{ id: string }>
}

interface UpdateProjectBody {
  client_id?: string
  name?: string
  status?: string
}

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params
    const body = (await request.json()) as UpdateProjectBody

    const name = body.name?.trim()
    const clientId = body.client_id?.trim()
    const status = body.status?.trim().toUpperCase() as ProjectStatus | undefined

    if (!name && !clientId && !status) {
      return NextResponse.json({ success: false, error: 'At least one field is required' }, { status: 400 })
    }

    if (status && !PROJECT_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid project status' }, { status: 400 })
    }

    const existingProject = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!existingProject) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    if (clientId) {
      const clientExists = await db.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      })

      if (!clientExists) {
        return NextResponse.json({ success: false, error: 'Client not found' }, { status: 404 })
      }
    }

    const data: { name?: string; client_id?: string; status?: ProjectStatus } = {}

    if (name) data.name = name
    if (clientId) data.client_id = clientId
    if (status) data.status = status

    const updatedProject = await db.project.update({
      where: { id: projectId },
      data,
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

    return NextResponse.json({ success: true, data: updatedProject })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update project' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params

    const existingProject = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!existingProject) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    await db.project.delete({
      where: { id: projectId },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete project' }, { status: 500 })
  }
}
