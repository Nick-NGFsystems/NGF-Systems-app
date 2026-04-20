'use client'

import { usePathname } from 'next/navigation'
import PortalNavbar from './PortalNavbar'
import type { ClientConfig } from '@/types'

interface PortalLayoutProps {
  children: React.ReactNode
  config: ClientConfig
}

export default function PortalLayout({ children, config }: PortalLayoutProps) {
  const pathname = usePathname()
  const fullBleed = pathname === '/portal/website'

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <PortalNavbar config={config} />
      <main className={fullBleed
        ? 'flex-1 overflow-hidden w-full'
        : 'flex-1 overflow-y-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:max-w-7xl lg:mx-auto'
      }>
        {children}
      </main>
    </div>
  )
}
