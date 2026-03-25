import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <section className="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl lg:grid-cols-2">
          <div className="order-2 flex flex-col justify-between gap-10 bg-slate-950 p-6 text-white sm:p-10 lg:order-1 lg:p-12">
            <div>
              <p className="font-sans text-3xl font-semibold tracking-tight text-blue-400">NGFsystems</p>
              <h1 className="mt-6 max-w-lg font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
                Create your account and start using the client portal immediately.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
                Submit project requests, review invoices, and stay aligned with delivery updates from a single dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Requests</p>
                <p className="mt-2 text-sm text-slate-100">Share website goals, changes, and launch needs in one workflow.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Visibility</p>
                <p className="mt-2 text-sm text-slate-100">See updates, invoices, and content tasks without waiting on manual follow-up.</p>
              </div>
            </div>
          </div>

          <div className="order-1 flex items-center justify-center bg-slate-50 p-4 sm:p-8 lg:order-2 lg:p-12">
            <div className="w-full max-w-[420px]">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: 'w-full',
                    card: 'w-full rounded-2xl border border-gray-200 shadow-xl',
                  },
                }}
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
