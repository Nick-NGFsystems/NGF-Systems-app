import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex">
      {/* Left side - Dark background with branding (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1a1a2e] to-[#16213e] flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">NGFsystems</h1>
          <p className="text-xl text-gray-300">Client Portal & Business Management</p>
        </div>
      </div>

      {/* Right side - White background with Clerk form */}
      <div className="w-full md:w-1/2 flex items-center justify-center bg-white p-4">
        <SignUp />
      </div>
    </main>
  )
}
