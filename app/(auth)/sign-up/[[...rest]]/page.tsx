import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl grid-cols-1 items-stretch gap-6 sm:min-h-[calc(100vh-4rem)] lg:grid-cols-2">
        <section className="hidden rounded-2xl bg-slate-900 p-10 shadow-sm lg:flex lg:flex-col lg:justify-between xl:p-12">
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

        <section className="flex items-center justify-center rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-8">
          <div className="w-full max-w-md">
            <div className="mb-6 text-center lg:hidden">
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
