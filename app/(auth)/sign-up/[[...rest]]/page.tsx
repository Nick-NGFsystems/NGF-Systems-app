import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-dvh bg-slate-950 px-4 py-4 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2rem)] w-full max-w-6xl grid-cols-1 items-center gap-6 sm:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,420px)] lg:gap-10">
        <section className="hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-xl lg:flex lg:flex-col lg:justify-between xl:p-12">
          <p className="font-sans text-3xl font-semibold tracking-tight text-blue-500">NGFsystems</p>
          <div>
            <h1 className="max-w-md font-sans text-4xl font-semibold tracking-tight text-white">
              Client Portal &amp; Business Management
            </h1>
            <p className="mt-4 max-w-md text-base text-slate-300">
              Create your account to submit requests, review invoices, and stay connected.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center rounded-3xl border border-slate-800 bg-white p-3 shadow-sm sm:p-6">
          <div className="w-full max-w-md">
            <div className="mb-5 text-center lg:hidden">
              <p className="font-sans text-2xl font-semibold tracking-tight text-blue-600">NGFsystems</p>
              <p className="mt-2 text-sm text-gray-500">Client Portal &amp; Business Management</p>
            </div>
            <SignUp
              appearance={{
                elements: {
                  rootBox: 'mx-auto w-full',
                  card: 'w-full border-0 bg-transparent p-0 shadow-none',
                },
              }}
            />
          </div>
        </section>
      </div>
    </main>
  )
}
