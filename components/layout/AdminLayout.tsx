import { redirect } from 'next/navigation'
import { currentUser } from '@clerk/nextjs/server'
import AdminNavbar from './AdminNavbar'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  const metadata = user.publicMetadata as { role?: string }
  if (metadata?.role !== 'admin') {
    redirect('/unauthorized')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
