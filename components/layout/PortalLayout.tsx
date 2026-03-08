import React from 'react'

interface PortalLayoutProps {
  children: React.ReactNode
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  return (
    <div className="flex h-screen flex-col">
      <header className="bg-white shadow">{/* Portal Navbar */}</header>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}
