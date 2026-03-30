import { db } from '@/lib/db'
import FinancesManager from '@/components/admin/FinancesManager'

export const dynamic = 'force-dynamic'

export default async function FinancesPage() {
  const [recurringIncome, recurringExpenses, oneTimeTransactions, budgetAllocations, workMileage] = await Promise.all([
    db.recurringIncome.findMany({ orderBy: { created: 'desc' } }),
    db.recurringExpense.findMany({ orderBy: { created: 'desc' } }),
    db.oneTimeTransaction.findMany({ orderBy: { date: 'desc' } }),
    db.budgetAllocation.findMany({ orderBy: { created: 'desc' } }),
    db.workMileage.findMany({ orderBy: { date: 'desc' } }),
  ])

  // Calculate monthly income
  const monthlyIncome = recurringIncome.reduce((sum, item) => {
    return sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount)
  }, 0)

  // Calculate monthly expenses
  const monthlyExpenses = recurringExpenses.reduce((sum, item) => {
    return sum + (item.frequency === 'YEARLY' ? item.amount / 12 : item.amount)
  }, 0)

  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const monthlyMileageTotal = workMileage.reduce((sum, item) => {
    const mileageDate = new Date(item.date)
    if (mileageDate.getMonth() !== currentMonth || mileageDate.getFullYear() !== currentYear) {
      return sum
    }

    return sum + item.miles * item.rate_per_mile
  }, 0)

  const yearlyMileageTotal = workMileage.reduce((sum, item) => {
    const mileageDate = new Date(item.date)
    if (mileageDate.getFullYear() !== currentYear) {
      return sum
    }

    return sum + item.miles * item.rate_per_mile
  }, 0)

  // Calculate net income, including mileage reimbursement costs.
  const totalMonthlyExpenses = monthlyExpenses + monthlyMileageTotal
  const netIncome = monthlyIncome - totalMonthlyExpenses
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

  const serializedMileage = workMileage.map((item) => ({
    ...item,
    date: item.date.toISOString(),
    created: item.created.toISOString(),
    updated: item.updated.toISOString(),
  }))

  return (
    <FinancesManager
      recurringIncome={serializedIncome}
      recurringExpenses={serializedExpenses}
      oneTimeTransactions={serializedTransactions}
      budgetAllocations={serializedAllocations}
      workMileage={serializedMileage}
      monthlyIncome={monthlyIncome}
      monthlyExpenses={totalMonthlyExpenses}
      netIncomeMonthly={netIncomeMonthly}
      netIncomeYearly={netIncomeYearly}
      oneTimeTotal={oneTimeTotal}
      monthlyMileageTotal={monthlyMileageTotal}
      yearlyMileageTotal={yearlyMileageTotal}
    />
  )
}
