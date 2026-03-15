interface EmptyState {
  title: string
  description: string
}

const emptyState: EmptyState = {
  title: 'No time entries yet',
  description: 'Logged hours will appear here once you start tracking time for projects.',
}

export default function TimePage() {
  return (
    <section className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Time Tracking</h1>
        <button
          type="button"
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Log Time
        </button>
      </header>

      <section className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">{emptyState.title}</p>
          <p className="mt-2 text-sm text-gray-500">{emptyState.description}</p>
        </div>
      </section>
    </section>
  )
}
