import PortalNavbar from './PortalNavbar'
import { ClientConfig } from '@prisma/client'

interface PortalLayoutProps {
  children: React.ReactNode
  config: ClientConfig
}

export default function PortalLayout({ children, config }: PortalLayoutProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white">
      <PortalNavbar config={config} />
      <main className="flex-1 overflow-y-auto w-full px-4 py-6 sm:px-6 lg:px-8 lg:max-w-7xl lg:mx-auto">
        {children}
      </main>
    </div>
  )
}
