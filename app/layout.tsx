import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata = {
  title: 'NGFsystems',
  description: 'NGFsystems client portal'
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="min-h-screen overflow-x-hidden bg-white text-slate-900 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
