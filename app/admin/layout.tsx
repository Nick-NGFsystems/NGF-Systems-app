import AdminLayout from '@/components/layout/AdminLayout'
import { ReactNode } from 'react'

export default function AdminGroupLayout({ 
  children 
}: { 
  children: ReactNode 
}) {
  return <AdminLayout>{children}</AdminLayout>
}
