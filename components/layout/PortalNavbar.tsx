'use client'
import { useState } from 'react'
import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'
import NavLink from './NavLink'
import type { ClientConfig } from '@/types'

interface PortalNavbarLink {
  label: string
  href: string
}

interface PortalNavbarProps {
  config: ClientConfig
}

export default function PortalNavbar({ config }: PortalNavbarProps) {
  const [isOpen, setIsOpen] = useState(false)

  const links: PortalNavbarLink[] = [
    { label: 'Dashboard', href: '/portal/portal-dashboard' },
    ...(config.page_website ? [
      { label: 'Website Editor', href: '/portal/website' },
      { label: 'My Website', href: '/portal/portal-website' },
    ] : []),
    ...(config.page_content ? [{ label: 'Content', href: '/portal/portal-content' }] : []),
    ...(config.page_invoices ? [{ label: 'Invoices', href: '/portal/portal-invoices' }] : []),
    ...(config.page_request ? [{ label: 'Request', href: '/portal/portal-request' }] : []),
  ]

  return (
    <nav className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 shadow-sm backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/portal/portal-dashboard" className="shrink-0">
            <span className="font-sans text-xl font-semibold tracking-tight text-blue-600">
              NGFsystems
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>

          <div className="flex items-center gap-3">
            <UserButton afterSignOutUrl="/sign-in" />
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-gray-700 transition hover:bg-gray-50 md:hidden"
              aria-label="Toggle portal navigation"
              aria-expanded={isOpen}
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {isOpen && (
          <div className="border-t border-gray-100 py-3 md:hidden">
            {links.map((link) => (
              <NavLink
                key={link.href}
                href={link.href}
                label={link.label}
                mobile
                onNavigate={() => setIsOpen(false)}
              />
            ))}
          </div>
        )}
      </div>
    </nav>
  )
}
