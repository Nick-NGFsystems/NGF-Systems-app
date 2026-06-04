'use client'

// The Overview tab of the finances hub. Pure read-only: every number is derived
// from the same data the rest of the page edits — nothing here writes or mutates.

import { DonutChart, MonthlyBars, AllocationBar, CHART_COLORS, type Segment, type MonthDatum } from './charts'
import {
  formatCurrency,
  monthlyAmount,
  isExpenseActiveInMonth,
  trailingMonths,
} from './format'

interface RecurringIncome { id: string; name: string; amount: number; frequency: string }
interface RecurringExpense { id: string; name: string; amount: number; frequency: string; category: string; start_date: string; end_date: string | null }
interface OneTimeTransaction { id: string; name: string; amount: number; type: string; date: string }
interface WorkMileage { id: string; date: string; miles: number; rate_per_mile: number }
interface BudgetAllocation { id: string; name: string; percentage: number }

interface OverviewProps {
  recurringIncome: RecurringIncome[]
  recurringExpenses: RecurringExpense[]
  oneTimeTransactions: OneTimeTransaction[]
  workMileage: WorkMileage[]
  budgetAllocations: BudgetAllocation[]
  monthlyIncome: number
  monthlyExpenses: number
  netIncomeMonthly: number
  netIncomeYearly: number
  oneTimeTotal: number
  monthlyMileageTotal: number
  yearlyMileageTotal: number
}

function KpiCard({ label, value, tone = 'neutral', hint }: { label: string; value: string; tone?: 'neutral' | 'pos' | 'neg' | 'signed'; hint?: string }) {
  const color =
    tone === 'pos' ? 'text-green-600'
    : tone === 'neg' ? 'text-red-600'
    : 'text-slate-900'
  return (
    <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`mt-2 font-sans text-2xl font-semibold tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </article>
  )
}

export default function FinanceOverview({
  recurringIncome,
  recurringExpenses,
  oneTimeTransactions,
  workMileage,
  budgetAllocations,
  monthlyIncome,
  monthlyExpenses,
  netIncomeMonthly,
  netIncomeYearly,
  oneTimeTotal,
  monthlyMileageTotal,
  yearlyMileageTotal,
}: OverviewProps) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  const recurringMonthlyIncome = recurringIncome.reduce((s, i) => s + monthlyAmount(i.amount, i.frequency), 0)

  // ── Trailing-12-month income vs expense series ─────────────────────────────
  const series: MonthDatum[] = trailingMonths(12, now).map((m) => {
    const oneTimeIncome = oneTimeTransactions
      .filter((t) => t.type === 'INCOME' && new Date(t.date).getFullYear() === m.year && new Date(t.date).getMonth() === m.monthIndex)
      .reduce((s, t) => s + t.amount, 0)

    const recurringExp = recurringExpenses
      .filter((e) => isExpenseActiveInMonth(e.start_date, e.end_date, m.year, m.monthIndex))
      .reduce((s, e) => s + monthlyAmount(e.amount, e.frequency), 0)

    const mileageExp = workMileage
      .filter((w) => new Date(w.date).getFullYear() === m.year && new Date(w.date).getMonth() === m.monthIndex)
      .reduce((s, w) => s + w.miles * w.rate_per_mile, 0)

    const oneTimeExp = oneTimeTransactions
      .filter((t) => t.type === 'EXPENSE' && new Date(t.date).getFullYear() === m.year && new Date(t.date).getMonth() === m.monthIndex)
      .reduce((s, t) => s + t.amount, 0)

    return {
      label: m.label,
      income: recurringMonthlyIncome + oneTimeIncome,
      expense: recurringExp + mileageExp + oneTimeExp,
    }
  })

  // ── Year-to-date, derived from the same series (months in the current year) ─
  const ytdMonths = trailingMonths(12, now)
    .map((m, i) => ({ ...m, datum: series[i] }))
    .filter((m) => m.year === currentYear && m.monthIndex <= currentMonth)
  const ytdIncome = ytdMonths.reduce((s, m) => s + m.datum.income, 0)
  const ytdExpenses = ytdMonths.reduce((s, m) => s + m.datum.expense, 0)
  const ytdNet = ytdIncome - ytdExpenses

  // ── This month's expense composition (donut) ───────────────────────────────
  const catTotals = new Map<string, number>()
  recurringExpenses
    .filter((e) => isExpenseActiveInMonth(e.start_date, e.end_date, currentYear, currentMonth))
    .forEach((e) => {
      const label = e.category || 'OTHER'
      catTotals.set(label, (catTotals.get(label) ?? 0) + monthlyAmount(e.amount, e.frequency))
    })
  const oneTimeExpThisMonth = oneTimeTransactions
    .filter((t) => t.type === 'EXPENSE' && new Date(t.date).getFullYear() === currentYear && new Date(t.date).getMonth() === currentMonth)
    .reduce((s, t) => s + t.amount, 0)
  if (oneTimeExpThisMonth > 0) catTotals.set('One-Time', oneTimeExpThisMonth)
  if (monthlyMileageTotal > 0) catTotals.set('Mileage', monthlyMileageTotal)

  const expenseSegments: Segment[] = Array.from(catTotals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .map((s, i) => ({ ...s, color: CHART_COLORS[i % CHART_COLORS.length] }))

  // ── Budget allocations as dollars of monthly net ────────────────────────────
  const allocBase = Math.max(0, netIncomeMonthly)
  const totalAllocPct = budgetAllocations.reduce((s, a) => s + a.percentage, 0)

  return (
    <div className="space-y-8">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Monthly Income" value={formatCurrency(monthlyIncome)} tone="pos" hint="recurring, at current rates" />
        <KpiCard label="Monthly Expenses" value={formatCurrency(monthlyExpenses)} tone="neg" hint="recurring + mileage this month" />
        <KpiCard label="Net / Month" value={formatCurrency(netIncomeMonthly)} tone={netIncomeMonthly >= 0 ? 'pos' : 'neg'} />
        <KpiCard label="Net / Year (projected)" value={formatCurrency(netIncomeYearly)} tone={netIncomeYearly >= 0 ? 'pos' : 'neg'} hint="monthly net × 12" />
        <KpiCard label="YTD Income" value={formatCurrency(ytdIncome)} hint={`${currentYear} so far`} />
        <KpiCard label="YTD Expenses" value={formatCurrency(ytdExpenses)} hint={`${currentYear} so far`} />
        <KpiCard label="YTD Net" value={formatCurrency(ytdNet)} tone={ytdNet >= 0 ? 'pos' : 'neg'} />
        <KpiCard label="Mileage Deduction (YTD)" value={formatCurrency(yearlyMileageTotal)} hint="tax-deductible, miles × rate" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-sans text-lg font-semibold text-slate-900">Income vs Expenses</h2>
          <p className="mb-4 text-xs text-gray-400">Last 12 months · recurring at current rates + actual one-time &amp; mileage</p>
          <MonthlyBars data={series} />
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-1 font-sans text-lg font-semibold text-slate-900">Expense Breakdown</h2>
          <p className="mb-4 text-xs text-gray-400">This month, by category</p>
          <DonutChart segments={expenseSegments} centerLabel="This month" centerValue={monthlyExpenses} />
        </section>
      </div>

      {/* Budget allocations */}
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-sans text-lg font-semibold text-slate-900">Budget Allocations</h2>
          <span className="text-xs text-gray-400">
            of net monthly ({formatCurrency(allocBase)}) ·{' '}
            <span className={totalAllocPct === 100 ? 'text-green-600' : totalAllocPct === 0 ? 'text-gray-400' : 'text-amber-600'}>
              {totalAllocPct.toFixed(totalAllocPct % 1 === 0 ? 0 : 1)}% allocated
            </span>
          </span>
        </div>
        {budgetAllocations.length === 0 ? (
          <p className="text-sm text-gray-400">No allocations set. Add them in the Budget tab to split your net income into categories.</p>
        ) : (
          <div className="space-y-3">
            {budgetAllocations.map((a, i) => (
              <AllocationBar
                key={a.id}
                label={a.name}
                percentage={a.percentage}
                dollars={(a.percentage / 100) * allocBase}
                color={CHART_COLORS[i % CHART_COLORS.length]}
              />
            ))}
          </div>
        )}
        {netIncomeMonthly <= 0 && budgetAllocations.length > 0 && (
          <p className="mt-3 text-xs text-amber-600">Net monthly is not positive, so allocation dollar amounts show as $0. They&apos;ll populate once net income is positive.</p>
        )}
      </section>

      {/* One-time lifetime total (kept visible from the old summary) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard label="One-Time Income (all time)" value={formatCurrency(oneTimeTotal)} hint="sum of one-time INCOME transactions" />
        <KpiCard
          label="One-Time Expenses (all time)"
          value={formatCurrency(oneTimeTransactions.filter((t) => t.type === 'EXPENSE').reduce((s, t) => s + t.amount, 0))}
          hint="sum of one-time EXPENSE transactions"
        />
      </div>
    </div>
  )
}
