import PortalNavbar from './PortalNavbar'
import { ClientConfig } from '@prisma/client'

interface PortalLayoutProps {
  children: React.ReactNode
  config: ClientConfig
}

export default function PortalLayout({ children, config }: PortalLayoutProps) {
  return (
    <div className="min-h-screen bg-white">
      <PortalNavbar config={config} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
