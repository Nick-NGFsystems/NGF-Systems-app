import Link from 'next/link'

export default function RootPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-8 lg:px-12">
        <header className="flex items-center justify-center sm:justify-start">
          <p className="font-sans text-2xl font-semibold tracking-tight text-blue-600">NGFsystems</p>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="max-w-3xl font-sans text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Web solutions, simplified.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-gray-500 sm:text-lg">
            A focused workspace for clients and admins to manage websites, projects, and growth.
          </p>

          <div className="mt-10 grid w-full max-w-md grid-cols-1 gap-3 sm:grid-cols-2">
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Client Login
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-900 transition hover:border-blue-600 hover:text-blue-600"
            >
              Admin Login
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
