import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-6xl items-center justify-center sm:min-h-[calc(100dvh-4rem)]">
        <section className="w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/95 p-4 shadow-xl sm:p-6 lg:p-8">
          <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)] lg:gap-10">
            <div className="order-2 flex flex-col justify-center lg:order-1">
              <p className="font-sans text-3xl font-semibold tracking-tight text-blue-400">NGFsystems</p>
              <h1 className="mt-5 max-w-md font-sans text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Client Portal &amp; Business Management
              </h1>
              <p className="mt-4 max-w-md text-base text-slate-300">
                Sign in to view project updates, track invoices, and manage website requests.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2">
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

            <div className="order-1 flex items-center justify-center lg:order-2">
              <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-white p-3 shadow-sm sm:p-6">
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
