import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import PortalNavbar from './PortalNavbar'

interface PortalLayoutProps {
  children: React.ReactNode
}

export default async function PortalLayout({ children }: PortalLayoutProps) {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  const metadata = user.publicMetadata as { role?: string }
  if (metadata?.role !== 'client') {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-white">
      <PortalNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
