interface FinanceSection {
  title: string
  emptyTitle: string
  emptyDescription: string
}

const financeSections: FinanceSection[] = [
  {
    title: 'Invoices',
    emptyTitle: 'No invoices yet',
    emptyDescription: 'Generated invoices will appear here once you create your first billing record.',
  },
  {
    title: 'Expenses',
    emptyTitle: 'No expenses yet',
    emptyDescription: 'Track business costs here to keep your financial snapshot accurate.',
  },
]

export default function FinancesPage() {
  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Finances</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {financeSections.map((section) => (
          <section key={section.title} className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">{section.title}</h2>
            <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
              <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">
                {section.emptyTitle}
              </p>
              <p className="mt-2 text-sm text-gray-500">{section.emptyDescription}</p>
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}
