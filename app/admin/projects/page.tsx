import ProjectsManager from '@/components/admin/ProjectsManager'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const [projects, clients] = await Promise.all([
    db.project.findMany({
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
    }),
    db.client.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'LEAD'],
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        created: 'desc',
      },
    }),
  ])

  const serializedProjects = projects.map((project) => ({
    ...project,
    created: project.created.toISOString(),
    updated: project.updated.toISOString(),
    tasks: project.tasks.map((task) => ({
      ...task,
      created: task.created.toISOString(),
      updated: task.updated.toISOString(),
    })),
  }))

  return <ProjectsManager projects={serializedProjects} clients={clients} />
}
