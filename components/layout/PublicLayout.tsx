import React from 'react'

interface PublicLayoutProps {
  children: React.ReactNode
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-white shadow">{/* Public Navbar */}</header>
      <main className="flex-1">{children}</main>
      <footer className="bg-gray-900 text-white">{/* Footer */}</footer>
    </div>
  )
}
