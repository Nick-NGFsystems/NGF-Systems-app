import React from 'react'

interface AdminLayoutProps {
  children: React.ReactNode
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-gray-900 text-white">{/* Admin Sidebar */}</nav>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
