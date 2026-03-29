'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface RecurringIncome {
  id: string
  name: string
  amount: number
  frequency: string
  notes: string | null
  created: string
  updated: string
}

interface RecurringExpense {
  id: string
  name: string
  amount: number
  frequency: string
  category: string
  notes: string | null
  created: string
  updated: string
}

interface OneTimeTransaction {
  id: string
  name: string
  amount: number
  type: string
  date: string
  notes: string | null
  created: string
  updated: string
}

interface BudgetAllocation {
  id: string
  name: string
  percentage: number
  notes: string | null
  created: string
  updated: string
}

interface FinancesManagerProps {
  recurringIncome: RecurringIncome[]
  recurringExpenses: RecurringExpense[]
  oneTimeTransactions: OneTimeTransaction[]
  budgetAllocations: BudgetAllocation[]
  monthlyIncome: number
  monthlyExpenses: number
  netIncome: number
  oneTimeThisMonth: number
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export default function FinancesManager({
  recurringIncome,
  recurringExpenses,
  oneTimeTransactions,
  budgetAllocations,
  monthlyIncome,
  monthlyExpenses,
  netIncome,
  oneTimeThisMonth,
}: FinancesManagerProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const totalAllocationPercentage = budgetAllocations.reduce((sum, alloc) => sum + alloc.percentage, 0)

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Finances</h1>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Monthly Income</p>
          <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrency(monthlyIncome)}
          </p>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Monthly Expenses</p>
          <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrency(monthlyExpenses)}
          </p>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">Net Income</p>
          <p className={`mt-3 font-sans text-3xl font-semibold tracking-tight ${netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(netIncome)}
          </p>
        </article>

        <article className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-sm text-gray-500">One-Time This Month</p>
          <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-slate-900">
            {formatCurrency(oneTimeThisMonth)}
          </p>
        </article>
      </div>

      {/* Recurring Income Section */}
      <RecurringIncomeSection incomes={recurringIncome} onRefresh={() => router.refresh()} />

      {/* Recurring Expenses Section */}
      <RecurringExpensesSection expenses={recurringExpenses} onRefresh={() => router.refresh()} />

      {/* One-Time Transactions Section */}
      <OneTimeTransactionsSection transactions={oneTimeTransactions} onRefresh={() => router.refresh()} />

      {/* Budget Allocations Section */}
      <BudgetAllocationsSection allocations={budgetAllocations} totalPercentage={totalAllocationPercentage} onRefresh={() => router.refresh()} />
    </section>
  )
}

interface RecurringIncomeSectionProps {
  incomes: RecurringIncome[]
  onRefresh: () => void
}

function RecurringIncomeSection({ incomes, onRefresh }: RecurringIncomeSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIncomeId, setEditingIncomeId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('YEARLY')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingIncomeId(null)
    setName('')
    setAmount('')
    setFrequency('YEARLY')
    setNotes('')
  }

  const openCreateModal = () => {
    setError(null)
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (income: RecurringIncome) => {
    setError(null)
    setEditingIncomeId(income.id)
    setName(income.name)
    setAmount(String(income.amount))
    setFrequency(income.frequency)
    setNotes(income.notes ?? '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const endpoint = editingIncomeId
        ? `/api/admin/finances/recurring-income/${editingIncomeId}`
        : '/api/admin/finances/recurring-income'

      const response = await fetch(endpoint, {
        method: editingIncomeId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: Number(amount),
          frequency,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || `Failed to ${editingIncomeId ? 'update' : 'create'} income`)
        return
      }

      setIsModalOpen(false)
      resetForm()
      onRefresh()
    } catch (err) {
      setError(`Failed to ${editingIncomeId ? 'update' : 'create'} income`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this income?')) return

    try {
      const response = await fetch(`/api/admin/finances/recurring-income/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete income')
    }
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">Recurring Income</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Add Income
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 space-y-3">
        {incomes.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No recurring income yet.</p>
        ) : (
          incomes.map((income) => (
            <div key={income.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div>
                <p className="font-medium text-gray-900">{income.name}</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(income.amount)} {income.frequency === 'YEARLY' ? 'per year' : 'per month'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(income)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(income.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {editingIncomeId ? 'Edit Recurring Income' : 'Add Recurring Income'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError(null)
                    resetForm()
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (editingIncomeId ? 'Saving...' : 'Adding...') : editingIncomeId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

interface RecurringExpensesSectionProps {
  expenses: RecurringExpense[]
  onRefresh: () => void
}

function RecurringExpensesSection({ expenses, onRefresh }: RecurringExpensesSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [frequency, setFrequency] = useState('YEARLY')
  const [category, setCategory] = useState('OTHER')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingExpenseId(null)
    setName('')
    setAmount('')
    setFrequency('YEARLY')
    setCategory('OTHER')
    setNotes('')
  }

  const openCreateModal = () => {
    setError(null)
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (expense: RecurringExpense) => {
    setError(null)
    setEditingExpenseId(expense.id)
    setName(expense.name)
    setAmount(String(expense.amount))
    setFrequency(expense.frequency)
    setCategory(expense.category)
    setNotes(expense.notes ?? '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const endpoint = editingExpenseId
        ? `/api/admin/finances/recurring-expenses/${editingExpenseId}`
        : '/api/admin/finances/recurring-expenses'

      const response = await fetch(endpoint, {
        method: editingExpenseId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: Number(amount),
          frequency,
          category,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || `Failed to ${editingExpenseId ? 'update' : 'create'} expense`)
        return
      }

      setIsModalOpen(false)
      resetForm()
      onRefresh()
    } catch (err) {
      setError(`Failed to ${editingExpenseId ? 'update' : 'create'} expense`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this expense?')) return

    try {
      const response = await fetch(`/api/admin/finances/recurring-expenses/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete expense')
    }
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">Recurring Expenses</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Add Expense
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 space-y-3">
        {expenses.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No recurring expenses yet.</p>
        ) : (
          expenses.map((expense) => (
            <div key={expense.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div>
                <p className="font-medium text-gray-900">{expense.name}</p>
                <p className="text-sm text-gray-500">
                  {formatCurrency(expense.amount)} {expense.frequency === 'YEARLY' ? 'per year' : 'per month'} • {expense.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(expense)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(expense.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {editingExpenseId ? 'Edit Recurring Expense' : 'Add Recurring Expense'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="MONTHLY">Monthly</option>
                  <option value="YEARLY">Yearly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="SOFTWARE">Software</option>
                  <option value="HOSTING">Hosting</option>
                  <option value="TOOLS">Tools</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError(null)
                    resetForm()
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (editingExpenseId ? 'Saving...' : 'Adding...') : editingExpenseId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

interface OneTimeTransactionsSectionProps {
  transactions: OneTimeTransaction[]
  onRefresh: () => void
}

function OneTimeTransactionsSection({ transactions, onRefresh }: OneTimeTransactionsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTransactionId, setEditingTransactionId] = useState<string | null>(null)
  const [transactionType, setTransactionType] = useState('EXPENSE')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingTransactionId(null)
    setTransactionType('EXPENSE')
    setName('')
    setAmount('')
    setDate('')
    setNotes('')
  }

  const openCreateModal = () => {
    setError(null)
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (transaction: OneTimeTransaction) => {
    setError(null)
    setEditingTransactionId(transaction.id)
    setTransactionType(transaction.type)
    setName(transaction.name)
    setAmount(String(transaction.amount))
    setDate(transaction.date.slice(0, 10))
    setNotes(transaction.notes ?? '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const endpoint = editingTransactionId
        ? `/api/admin/finances/one-time/${editingTransactionId}`
        : '/api/admin/finances/one-time'

      const response = await fetch(endpoint, {
        method: editingTransactionId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount: Number(amount),
          type: transactionType,
          date,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || `Failed to ${editingTransactionId ? 'update' : 'create'} transaction`)
        return
      }

      setIsModalOpen(false)
      resetForm()
      onRefresh()
    } catch (err) {
      setError(`Failed to ${editingTransactionId ? 'update' : 'create'} transaction`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return

    try {
      const response = await fetch(`/api/admin/finances/one-time/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete transaction')
    }
  }

  const income = transactions.filter((t) => t.type === 'INCOME')
  const expenses = transactions.filter((t) => t.type === 'EXPENSE')

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">One-Time Transactions</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Add Transaction
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="mt-5 space-y-6">
        {/* Income Subsection */}
        <div>
          <h3 className="font-medium text-gray-900">Income</h3>
          <div className="mt-3 space-y-3">
            {income.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No income transactions.</p>
            ) : (
              income.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.name}</p>
                    <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-green-600">{formatCurrency(transaction.amount)}</p>
                    <button
                      type="button"
                      onClick={() => openEditModal(transaction)}
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(transaction.id)}
                      className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Expense Subsection */}
        <div>
          <h3 className="font-medium text-gray-900">Expenses</h3>
          <div className="mt-3 space-y-3">
            {expenses.length === 0 ? (
              <p className="py-4 text-sm text-gray-500">No expense transactions.</p>
            ) : (
              expenses.map((transaction) => (
                <div key={transaction.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
                  <div>
                    <p className="font-medium text-gray-900">{transaction.name}</p>
                    <p className="text-sm text-gray-500">{formatDate(transaction.date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-red-600">{formatCurrency(transaction.amount)}</p>
                    <button
                      type="button"
                      onClick={() => openEditModal(transaction)}
                      className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(transaction.id)}
                      className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                >
                  <option value="INCOME">Income</option>
                  <option value="EXPENSE">Expense</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError(null)
                    resetForm()
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (editingTransactionId ? 'Saving...' : 'Adding...') : editingTransactionId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

interface BudgetAllocationsSectionProps {
  allocations: BudgetAllocation[]
  totalPercentage: number
  onRefresh: () => void
}

function BudgetAllocationsSection({ allocations, totalPercentage, onRefresh }: BudgetAllocationsSectionProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingAllocationId, setEditingAllocationId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [percentage, setPercentage] = useState('')
  const [notes, setNotes] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetForm = () => {
    setEditingAllocationId(null)
    setName('')
    setPercentage('')
    setNotes('')
  }

  const openCreateModal = () => {
    setError(null)
    resetForm()
    setIsModalOpen(true)
  }

  const openEditModal = (allocation: BudgetAllocation) => {
    setError(null)
    setEditingAllocationId(allocation.id)
    setName(allocation.name)
    setPercentage(String(allocation.percentage))
    setNotes(allocation.notes ?? '')
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const endpoint = editingAllocationId
        ? `/api/admin/finances/allocations/${editingAllocationId}`
        : '/api/admin/finances/allocations'

      const response = await fetch(endpoint, {
        method: editingAllocationId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          percentage: Number(percentage),
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || `Failed to ${editingAllocationId ? 'update' : 'create'} allocation`)
        return
      }

      setIsModalOpen(false)
      resetForm()
      onRefresh()
    } catch (err) {
      setError(`Failed to ${editingAllocationId ? 'update' : 'create'} allocation`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this allocation?')) return

    try {
      const response = await fetch(`/api/admin/finances/allocations/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onRefresh()
      }
    } catch (err) {
      console.error('Failed to delete allocation')
    }
  }

  const isBalanced = totalPercentage === 100
  const isWarning = totalPercentage !== 0 && !isBalanced

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">Budget Allocations</h2>
        <button
          type="button"
          onClick={openCreateModal}
          className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Add Allocation
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isWarning && (
        <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
          Total allocation is {totalPercentage}% (must be 100% for balanced budget)
        </div>
      )}

      {isBalanced && allocations.length > 0 && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Budget is balanced at 100%</div>
      )}

      <div className="mt-5 space-y-3">
        {allocations.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No budget allocations yet.</p>
        ) : (
          allocations.map((allocation) => (
            <div key={allocation.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-4">
              <div className="flex-1">
                <p className="font-medium text-gray-900">{allocation.name}</p>
                <div className="mt-2 h-2 w-full rounded-full bg-gray-200">
                  <div className="h-full rounded-full bg-blue-600" style={{ width: `${allocation.percentage}%` }} />
                </div>
                <p className="mt-1 text-sm text-gray-500">{allocation.percentage}%</p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(allocation)}
                  className="rounded-md border border-gray-200 px-3 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-100"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(allocation.id)}
                  className="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="relative w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h3 className="mb-4 text-lg font-semibold">
              {editingAllocationId ? 'Edit Budget Allocation' : 'Add Budget Allocation'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Percentage (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={percentage}
                  onChange={(e) => setPercentage(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false)
                    setError(null)
                    resetForm()
                  }}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? (editingAllocationId ? 'Saving...' : 'Adding...') : editingAllocationId ? 'Save' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
