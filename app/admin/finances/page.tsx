import FinancesManager from '@/components/admin/FinancesManager'
import { db } from '@/lib/db'

function isDateInCurrentMonth(date: Date, now: Date) {
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
}

function getMonthlyExpenseContribution(
  expense: { amount: number; type: string; paid_date: Date | null; created: Date },
  now: Date,
) {
  if (expense.type === 'MONTHLY') {
    return expense.amount
  }

  if (expense.type === 'YEARLY') {
    return expense.amount / 12
  }

  const referenceDate = expense.paid_date ?? expense.created
  return isDateInCurrentMonth(referenceDate, now) ? expense.amount : 0
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

export default async function FinancesPage() {
  const [clients, invoices, expenses] = await Promise.all([
    db.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.invoice.findMany({
      orderBy: { created: 'desc' },
    }),
    db.expense.findMany({
      orderBy: { created: 'desc' },
    }),
  ])

  const now = new Date()

  const monthlyRevenue = invoices
    .filter((invoice) => invoice.status === 'PAID' && invoice.paid_date && isDateInCurrentMonth(invoice.paid_date, now))
    .reduce((sum, invoice) => sum + invoice.amount, 0)

  const monthlyExpenses = expenses.reduce((sum, expense) => {
    return sum + getMonthlyExpenseContribution(expense, now)
  }, 0)

  const yearlyProjectedRevenue =
    invoices.filter((invoice) => invoice.type === 'MONTHLY').reduce((sum, invoice) => sum + invoice.amount, 0) * 12 +
    invoices.filter((invoice) => invoice.type === 'YEARLY').reduce((sum, invoice) => sum + invoice.amount, 0)

  const summaries = [
    { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue) },
    { label: 'Monthly Expenses', value: formatCurrency(monthlyExpenses) },
    { label: 'Net Profit', value: formatCurrency(monthlyRevenue - monthlyExpenses) },
    { label: 'Yearly Projected Revenue', value: formatCurrency(yearlyProjectedRevenue) },
  ]

  const serializedInvoices = invoices.map((invoice) => ({
    ...invoice,
    due_date: invoice.due_date ? invoice.due_date.toISOString() : null,
    paid_date: invoice.paid_date ? invoice.paid_date.toISOString() : null,
    created: invoice.created.toISOString(),
  }))

  const serializedExpenses = expenses.map((expense) => ({
    ...expense,
    paid_date: expense.paid_date ? expense.paid_date.toISOString() : null,
    next_due: expense.next_due ? expense.next_due.toISOString() : null,
    created: expense.created.toISOString(),
  }))

  return (
    <FinancesManager
      summaries={summaries}
      clients={clients}
      invoices={serializedInvoices}
      expenses={serializedExpenses}
    />
  )
}
