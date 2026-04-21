import { cache } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'

export const getClientConfig = cache(async (clerkUserId: string) => {
  // Fast path: already linked
  const linked = await db.client.findUnique({
    where: { clerk_user_id: clerkUserId },
    include: { config: true },
  })
  if (linked) return linked

  // Fallback: look up by email and link on first load.
  // Handles clients who existed before clerk_user_id was added.
  const user = await currentUser()
  const email = user?.emailAddresses[0]?.emailAddress
  if (!email) return null

  const byEmail = await db.client.findUnique({
    where: { email },
    include: { config: true },
  })
  if (!byEmail) return null

  // Link the Clerk user ID so the fast path works on every subsequent request
  await db.client.update({
    where: { id: byEmail.id },
    data: { clerk_user_id: clerkUserId },
  })

  return byEmail
})
