'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ClientOption {
  id: string
  name: string
  email: string
}

interface TaskItem {
  id: string
  project_id: string
  title: string
  status: string
  created: string
  updated: string
}

interface ProjectItem {
  id: string
  client_id: string
  name: string
  status: string
  created: string
  updated: string
  client: ClientOption
  tasks: TaskItem[]
}

interface ProjectsManagerProps {
  projects: ProjectItem[]
  clients: ClientOption[]
}

interface ApiResponse {
  success: boolean
  error?: string
}

const PROJECT_STATUSES = ['PENDING', 'IN_PROGRESS', 'ACTIVE', 'COMPLETED', 'ON_HOLD'] as const
const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'DONE'] as const

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getProjectStatusStyle(status: string) {
  if (status === 'COMPLETED') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'ACTIVE') return 'bg-blue-50 text-blue-700 border-blue-200'
  if (status === 'IN_PROGRESS') return 'bg-indigo-50 text-indigo-700 border-indigo-200'
  if (status === 'ON_HOLD') return 'bg-yellow-50 text-yellow-700 border-yellow-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

function getTaskStatusStyle(status: string) {
  if (status === 'DONE') return 'bg-green-50 text-green-700 border-green-200'
  if (status === 'IN_PROGRESS') return 'bg-blue-50 text-blue-700 border-blue-200'
  return 'bg-gray-100 text-gray-700 border-gray-200'
}

export default function ProjectsManager({ projects, clients }: ProjectsManagerProps) {
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false)
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [projectClientId, setProjectClientId] = useState('')
  const [projectStatus, setProjectStatus] = useState<(typeof PROJECT_STATUSES)[number]>('PENDING')
  const [projectError, setProjectError] = useState<string | null>(null)
  const [isSavingProject, setIsSavingProject] = useState(false)

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [taskInputs, setTaskInputs] = useState<Record<string, string>>({})
  const [taskErrors, setTaskErrors] = useState<Record<string, string>>({})
  const [isSavingTaskForProject, setIsSavingTaskForProject] = useState<Record<string, boolean>>({})

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return projects.filter((project) => {
      const matchesStatus = statusFilter === 'ALL' || project.status === statusFilter
      const matchesSearch =
        normalizedSearch.length === 0 ||
        project.name.toLowerCase().includes(normalizedSearch) ||
        project.client.name.toLowerCase().includes(normalizedSearch)

      return matchesStatus && matchesSearch
    })
  }, [projects, searchTerm, statusFilter])

  const summary = useMemo(() => {
    const total = projects.length
    const active = projects.filter((project) => project.status === 'ACTIVE' || project.status === 'IN_PROGRESS').length
    const completed = projects.filter((project) => project.status === 'COMPLETED').length
    const totalTasks = projects.reduce((sum, project) => sum + project.tasks.length, 0)

    return { total, active, completed, totalTasks }
  }, [projects])

  const closeProjectModal = () => {
    setIsProjectModalOpen(false)
    setEditingProjectId(null)
    setProjectName('')
    setProjectClientId('')
    setProjectStatus('PENDING')
    setProjectError(null)
  }

  const openCreateProjectModal = () => {
    setEditingProjectId(null)
    setProjectName('')
    setProjectClientId(clients[0]?.id ?? '')
    setProjectStatus('PENDING')
    setProjectError(null)
    setIsProjectModalOpen(true)
  }

  const openEditProjectModal = (project: ProjectItem) => {
    setEditingProjectId(project.id)
    setProjectName(project.name)
    setProjectClientId(project.client_id)
    setProjectStatus((PROJECT_STATUSES.includes(project.status as (typeof PROJECT_STATUSES)[number])
      ? project.status
      : 'PENDING') as (typeof PROJECT_STATUSES)[number])
    setProjectError(null)
    setIsProjectModalOpen(true)
  }

  const handleSaveProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProjectError(null)
    setIsSavingProject(true)

    try {
      const endpoint = editingProjectId ? `/api/admin/projects/${editingProjectId}` : '/api/admin/projects'
      const method = editingProjectId ? 'PATCH' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          client_id: projectClientId,
          status: projectStatus,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setProjectError(result.error ?? `Failed to ${editingProjectId ? 'update' : 'create'} project`)
        return
      }

      closeProjectModal()
      router.refresh()
    } catch {
      setProjectError(`Failed to ${editingProjectId ? 'update' : 'create'} project`)
    } finally {
      setIsSavingProject(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!window.confirm('Delete this project and all its tasks?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/projects/${projectId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  const handleAddTask = async (projectId: string) => {
    const title = taskInputs[projectId]?.trim()

    if (!title) {
      setTaskErrors((prev) => ({ ...prev, [projectId]: 'Task title is required' }))
      return
    }

    setTaskErrors((prev) => ({ ...prev, [projectId]: '' }))
    setIsSavingTaskForProject((prev) => ({ ...prev, [projectId]: true }))

    try {
      const response = await fetch(`/api/admin/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title, status: 'TODO' }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setTaskErrors((prev) => ({ ...prev, [projectId]: result.error ?? 'Failed to add task' }))
        return
      }

      setTaskInputs((prev) => ({ ...prev, [projectId]: '' }))
      router.refresh()
    } catch {
      setTaskErrors((prev) => ({ ...prev, [projectId]: 'Failed to add task' }))
    } finally {
      setIsSavingTaskForProject((prev) => ({ ...prev, [projectId]: false }))
    }
  }

  const handleTaskStatusChange = async (taskId: string, status: (typeof TASK_STATUSES)[number]) => {
    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      const result = (await response.json()) as ApiResponse
      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm('Delete this task?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/tasks/${taskId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as ApiResponse
      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Projects</h1>
        <button
          type="button"
          onClick={openCreateProjectModal}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          New Project
        </button>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Projects</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.total}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active</p>
          <p className="mt-2 text-2xl font-semibold text-blue-700">{summary.active}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Completed</p>
          <p className="mt-2 text-2xl font-semibold text-green-700">{summary.completed}</p>
        </article>
        <article className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Tasks</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{summary.totalTasks}</p>
        </article>
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px]">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by project or client"
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
          >
            <option value="ALL">All statuses</option>
            {PROJECT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3">
        {filteredProjects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center">
            <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No projects found</p>
            <p className="mt-2 text-sm text-gray-500">Create your first project to start organizing and tracking work.</p>
          </div>
        ) : (
          filteredProjects.map((project) => {
            const isExpanded = expandedProjectId === project.id
            const doneTasks = project.tasks.filter((task) => task.status === 'DONE').length
            const totalTasks = project.tasks.length

            return (
              <article key={project.id} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">{project.name}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getProjectStatusStyle(project.status)}`}>
                        {project.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-500">Client: {project.client.name}</span>
                      <span className="text-sm text-gray-400">Created {formatDate(project.created)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      {isExpanded ? 'Hide Tasks' : 'Manage Tasks'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditProjectModal(project)}
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProject(project.id)}
                      className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:max-w-sm">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-gray-500">Tasks Completed</p>
                    <p className="mt-1 font-semibold text-gray-900">{doneTasks} / {totalTasks}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-gray-500">Progress</p>
                    <p className="mt-1 font-semibold text-gray-900">
                      {totalTasks === 0 ? '0%' : `${Math.round((doneTasks / totalTasks) * 100)}%`}
                    </p>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        type="text"
                        value={taskInputs[project.id] ?? ''}
                        onChange={(event) =>
                          setTaskInputs((prev) => ({
                            ...prev,
                            [project.id]: event.target.value,
                          }))
                        }
                        placeholder="Add a task title"
                        className="h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAddTask(project.id)}
                        disabled={Boolean(isSavingTaskForProject[project.id])}
                        className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        {isSavingTaskForProject[project.id] ? 'Adding...' : 'Add Task'}
                      </button>
                    </div>

                    {taskErrors[project.id] && (
                      <p className="mt-2 text-sm text-red-600">{taskErrors[project.id]}</p>
                    )}

                    <div className="mt-3 space-y-2">
                      {project.tasks.length === 0 ? (
                        <p className="rounded-lg bg-white p-3 text-sm text-gray-500">No tasks yet for this project.</p>
                      ) : (
                        project.tasks.map((task) => (
                          <div key={task.id} className="flex flex-col gap-2 rounded-lg bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2">
                              <span className={`mt-0.5 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${getTaskStatusStyle(task.status)}`}>
                                {task.status.replace('_', ' ')}
                              </span>
                              <p className="text-sm text-gray-900">{task.title}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={task.status}
                                onChange={(event) =>
                                  handleTaskStatusChange(task.id, event.target.value as (typeof TASK_STATUSES)[number])
                                }
                                className="h-9 rounded-md border border-gray-300 px-2 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                              >
                                {TASK_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replace('_', ' ')}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </article>
            )
          })
        )}
      </section>

      {isProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h3 className="font-sans text-xl font-semibold tracking-tight text-gray-900">
              {editingProjectId ? 'Edit Project' : 'New Project'}
            </h3>

            <form onSubmit={handleSaveProject} className="mt-4 space-y-4">
              {projectError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{projectError}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">Project Name</label>
                <input
                  type="text"
                  required
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Client</label>
                <select
                  required
                  value={projectClientId}
                  onChange={(event) => setProjectClientId(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  <option value="" disabled>
                    Select client
                  </option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name} ({client.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  value={projectStatus}
                  onChange={(event) =>
                    setProjectStatus(event.target.value as (typeof PROJECT_STATUSES)[number])
                  }
                  className="mt-1 h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                >
                  {PROJECT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeProjectModal}
                  className="h-11 flex-1 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingProject}
                  className="h-11 flex-1 rounded-lg bg-blue-600 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {isSavingProject
                    ? editingProjectId
                      ? 'Saving...'
                      : 'Creating...'
                    : editingProjectId
                      ? 'Save Changes'
                      : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
