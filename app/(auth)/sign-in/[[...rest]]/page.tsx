import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-900 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <section className="w-full rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-sm sm:p-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col justify-center">
              <p className="font-sans text-3xl font-semibold tracking-tight text-blue-400">NGFsystems</p>
              <h1 className="mt-6 max-w-md font-sans text-4xl font-semibold tracking-tight text-white">
                Client Portal &amp; Business Management
              </h1>
              <p className="mt-4 max-w-md text-base text-slate-300">
                Sign in to view project updates, track invoices, and manage website requests.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Projects</p>
                  <p className="mt-1 text-sm text-white">Track active work and milestones</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-800/70 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Invoices</p>
                  <p className="mt-1 text-sm text-white">Review billing and payment status</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white p-4 shadow-sm sm:p-6">
                <SignIn
                  appearance={{
                    elements: {
                      rootBox: 'mx-auto w-full',
                      card: 'w-full border-0 bg-transparent p-0 shadow-none',
                    },
                  }}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
