import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <>
      <main className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-8 lg:hidden">
        <div className="w-full max-w-sm">
          <SignUp />
        </div>
      </main>

      <main className="hidden min-h-screen bg-gray-50 px-6 py-8 lg:block lg:px-8">
        <div className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-stretch gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-slate-900 p-12 shadow-sm">
            <div className="flex h-full flex-col justify-between">
              <p className="font-sans text-3xl font-semibold tracking-tight text-blue-500">NGFsystems</p>
              <div>
                <h1 className="max-w-md font-sans text-4xl font-semibold tracking-tight text-white">
                  Client Portal &amp; Business Management
                </h1>
                <p className="mt-4 max-w-md text-base text-slate-300">
                  Create your account to submit requests, review invoices, and stay connected.
                </p>
              </div>
            </div>
          </section>

          <section className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="w-full max-w-md">
              <SignUp
                appearance={{
                  elements: {
                    card: 'border-0 bg-transparent shadow-none',
                  },
                }}
              />
            </div>
          </section>
        </div>
      </main>
    </>
  )
}
