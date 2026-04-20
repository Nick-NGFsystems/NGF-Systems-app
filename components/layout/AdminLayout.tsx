import AdminNavbar from './AdminNavbar'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8 lg:max-w-7xl lg:mx-auto">
        {children}
      </main>
    </div>
  )
}
