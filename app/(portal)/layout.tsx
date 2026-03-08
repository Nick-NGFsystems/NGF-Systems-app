import PortalLayout from '@/components/layout/PortalLayout'
import { ReactNode } from 'react'

export default function PortalGroupLayout({ 
  children 
}: { 
  children: ReactNode 
}) {
  return <PortalLayout>{children}</PortalLayout>
}
