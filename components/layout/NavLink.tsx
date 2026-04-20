'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavLinkProps {
  href: string
  label: string
  mobile?: boolean
  onNavigate?: () => void
}

export default function NavLink({ href, label, mobile = false, onNavigate }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  const baseClass = mobile
    ? 'block rounded-lg px-3 py-2 text-base font-medium transition'
    : 'rounded-lg px-3 py-2 text-sm font-medium transition'

  const stateClass = isActive
    ? 'bg-blue-50 text-blue-600'
    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`${baseClass} ${stateClass}`}
      suppressHydrationWarning
    >
      {label}
    </Link>
  )
}
