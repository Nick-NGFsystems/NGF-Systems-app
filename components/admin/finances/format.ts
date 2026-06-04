// Shared formatting + finance math helpers for the admin finances hub.
// Pure, read-only — no data mutation. Mirrors the conventions already used in
// FinancesManager.tsx so the Overview computes identical numbers.

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

/** Compact currency for chart axis labels: $1.2k, $980, $3.4M. */
export function formatCurrencyShort(value: number): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return `${sign}$${Math.round(abs)}`
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Normalize a recurring amount to a monthly figure. */
export function monthlyAmount(amount: number, frequency: string): number {
  return frequency === 'YEARLY' ? amount / 12 : amount
}

/** True when a recurring stream's active window overlaps the given month.
 *  A null `startDate` means "no lower bound" (active from the beginning); a null
 *  `endDate` means "no upper bound" (ongoing). Used for both recurring expenses
 *  (always have a start) and recurring income (start optional). Matches the
 *  server-side logic in app/admin/finances/page.tsx. */
export function isActiveInMonth(
  startDate: string | null,
  endDate: string | null,
  year: number,
  monthIndex: number,
): boolean {
  const monthStart = new Date(year, monthIndex, 1)
  const monthEnd = new Date(year, monthIndex + 1, 0)
  if (startDate && new Date(startDate) > monthEnd) return false
  if (endDate && new Date(endDate) < monthStart) return false
  return true
}

export const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Returns the last `count` months (oldest → newest) as {year, monthIndex, label}. */
export function trailingMonths(count: number, ref: Date): { year: number; monthIndex: number; label: string }[] {
  const out: { year: number; monthIndex: number; label: string }[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1)
    out.push({ year: d.getFullYear(), monthIndex: d.getMonth(), label: MONTH_LABELS[d.getMonth()] })
  }
  return out
}
