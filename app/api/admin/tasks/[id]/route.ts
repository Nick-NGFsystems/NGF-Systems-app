import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const

type TaskStatus = (typeof TASK_STATUSES)[number]

interface RouteContext {
  params: Promise<{ id: string }>
}

interface UpdateTaskBody {
  title?: string
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

    const { id: taskId } = await context.params
    const body = (await request.json()) as UpdateTaskBody

    const title = body.title?.trim()
    const status = body.status?.trim().toUpperCase() as TaskStatus | undefined

    if (!title && !status) {
      return NextResponse.json({ success: false, error: 'At least one field is required' }, { status: 400 })
    }

    if (status && !TASK_STATUSES.includes(status)) {
      return NextResponse.json({ success: false, error: 'Invalid task status' }, { status: 400 })
    }

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    })

    if (!existingTask) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    const data: { title?: string; status?: TaskStatus } = {}
    if (title) data.title = title
    if (status) data.status = status

    const task = await db.task.update({
      where: { id: taskId },
      data,
    })

    return NextResponse.json({ success: true, data: task })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to update task' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const isAdmin = await validateAdmin()

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { id: taskId } = await context.params

    const existingTask = await db.task.findUnique({
      where: { id: taskId },
      select: { id: true },
    })

    if (!existingTask) {
      return NextResponse.json({ success: false, error: 'Task not found' }, { status: 404 })
    }

    await db.task.delete({
      where: { id: taskId },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to delete task' }, { status: 500 })
  }
}
