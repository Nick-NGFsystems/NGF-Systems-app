import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { getClientConfig } from '@/lib/portal'
import PortalLayout from '@/components/layout/PortalLayout'
import { ReactNode } from 'react'

export default async function PortalGroupLayout({
  children,
}: {
  children: ReactNode
}) {
  const { userId } = await auth()

  if (!userId) {
    redirect('/sign-in')
  }

  const client = await getClientConfig(userId)

  if (!client || !client.config) {
    redirect('/unauthorized')
  }

  return <PortalLayout config={client.config}>{children}</PortalLayout>
}
