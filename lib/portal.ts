import { cache } from 'react'
import { db } from '@/lib/db'

/**
 * Fetches the client record (with config) linked to a Clerk user.
 * Wrapped in React cache() so duplicate calls within the same request
 * (e.g. layout + page) only hit the database once.
 */
export const getClientConfig = cache(async (clerkUserId: string) => {
  return db.client.findUnique({
    where: { clerk_user_id: clerkUserId },
    include: { config: true },
  })
})
