import { clerkClient } from '@clerk/nextjs/server'

const CLERK_LIST_CHUNK_SIZE = 100

export async function getClientLastLoginMap(clerkUserIds: string[]): Promise<Record<string, number | null>> {
  const ids = Array.from(new Set(clerkUserIds.filter(Boolean)))
  const lastLoginMap: Record<string, number | null> = {}

  if (ids.length === 0) {
    return lastLoginMap
  }

  const clerk = await clerkClient()

  for (let index = 0; index < ids.length; index += CLERK_LIST_CHUNK_SIZE) {
    const chunk = ids.slice(index, index + CLERK_LIST_CHUNK_SIZE)

    const users = await clerk.users.getUserList({
      userId: chunk,
      limit: chunk.length,
    })

    for (const user of users.data) {
      lastLoginMap[user.id] = user.lastSignInAt ?? null
    }

    for (const id of chunk) {
      if (!(id in lastLoginMap)) {
        lastLoginMap[id] = null
      }
    }
  }

  return lastLoginMap
}

export function formatLastLogin(lastSignInAt: number | null | undefined): string {
  if (!lastSignInAt) {
    return 'Never'
  }

  return new Date(lastSignInAt).toLocaleString()
}
