import { db } from '@/lib/db'
import FinancesManager from '@/components/admin/FinancesManager'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
  const [recurringIncome, recurringExpenses, oneTimeTransactions, budgetAllocations] = await Promise.all([
    db.recurringIncome.findMany({ orderBy: { created: 'desc' } }),
    db.recurringExpense.findMany({ orderBy: { created: 'desc' } }),
    db.oneTimeTransaction.findMany({ orderBy: { date: 'desc' } }),
    db.budgetAllocation.findMany({ orderBy: { created: 'desc' } }),
  ])

  // Calculate monthly income
  const monthlyIncome = recurringIncome.reduce((sum, item) => {
    return sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount)
  }, 0)

  // Calculate monthly expenses
  const monthlyExpenses = recurringExpenses.reduce((sum, item) => {
    return sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount)
  }, 0)

  // Calculate net income
  const netIncome = monthlyIncome - monthlyExpenses
  const netIncomeMonthly = netIncome
  const netIncomeYearly = netIncome * 12

  // Calculate total one-time income
  const oneTimeTotal = oneTimeTransactions
    .filter((t) => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0)

  // Serialize dates
  const serializedIncome = recurringIncome.map((item) => ({
    ...item,
    created: item.created.toISOString(),
    updated: item.updated.toISOString(),
  }))

  const serializedExpenses = recurringExpenses.map((item) => ({
    ...item,
    created: item.created.toISOString(),
    updated: item.updated.toISOString(),
  }))

  const serializedTransactions = oneTimeTransactions.map((item) => ({
    ...item,
    date: item.date.toISOString(),
    created: item.created.toISOString(),
    updated: item.updated.toISOString(),
  }))

  const serializedAllocations = budgetAllocations.map((item) => ({
    ...item,
    created: item.created.toISOString(),
    updated: item.updated.toISOString(),
  }))

  return (
    <FinancesManager
      recurringIncome={serializedIncome}
      recurringExpenses={serializedExpenses}
      oneTimeTransactions={serializedTransactions}
      budgetAllocations={serializedAllocations}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={monthlyExpenses}
      netIncomeMonthly={netIncomeMonthly}
      netIncomeYearly={netIncomeYearly}
      oneTimeTotal={oneTimeTotal}
    />
  )
}
