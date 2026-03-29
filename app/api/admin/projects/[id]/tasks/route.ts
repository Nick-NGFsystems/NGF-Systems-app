import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const

type TaskStatus = (typeof TASK_STATUSES)[number]

interface RouteContext {
  params: Promise<{ id: string }>
}

interface CreateTaskBody {
  title?: string
  status?: string
}

async function validateAdmin() {
  const { sessionClaims } = await auth()
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role
  return role === 'admin'
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: projectId } = await context.params
    const body = (await request.json()) as CreateTaskBody

    const title = body.title?.trim()
    const status = (body.status?.trim().toUpperCase() ?? 'TODO') as TaskStatus

    if (!title) {
      return NextResponse.json({ success: false, error: 'Task title is required' }, { status: 400 })
    }

    if (!TASK_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid task status' }, { status: 400 })
    }

    const projectExists = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    })

    if (!projectExists) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 })
    }

    const task = await db.task.create({
      data: {
        project_id: projectId,
        title,
        status,
      },
    })

    return NextResponse.json({ success: true, data: task })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to create task' }, { status: 500 })
  }
}
