import { currentUser } from '@clerk/nextjs/server'

export async function isAdmin(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const metadata = user.publicMetadata as { role?: string }
  return metadata?.role === 'admin'
}

export async function isClient(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const metadata = user.publicMetadata as { role?: string }
  return metadata?.role === 'client'
}
