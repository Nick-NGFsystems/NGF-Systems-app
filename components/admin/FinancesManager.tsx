'use client'

import { FormEvent, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

interface FinanceSummary {
  label: string
  value: string
}

interface ClientItem {
  id: string
  name: string
}

interface InvoiceItem {
  id: string
  client_id: string | null
  title: string
  amount: number
  type: string
  status: string
  due_date: string | null
  paid_date: string | null
  notes: string | null
  created: string
}

interface ExpenseItem {
  id: string
  title: string
  amount: number
  type: string
  category: string
  paid_date: string | null
  next_due: string | null
  notes: string | null
  created: string
}

interface FinancesManagerProps {
  summaries: FinanceSummary[]
  clients: ClientItem[]
  invoices: InvoiceItem[]
  expenses: ExpenseItem[]
}

interface ApiResponse {
  success: boolean
  error?: string
}

const invoiceTypes = ['ONE_TIME', 'MONTHLY', 'YEARLY'] as const
const invoiceStatuses = ['PENDING', 'PAID', 'OVERDUE'] as const
const expenseTypes = ['ONE_TIME', 'MONTHLY', 'YEARLY'] as const
const expenseCategories = ['SOFTWARE', 'HOSTING', 'MARKETING', 'HARDWARE', 'OTHER'] as const

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: string | null) {
  if (!value) {
    return '—'
  }

  return new Date(value).toLocaleDateString()
}

function getStatusClasses(status: string) {
  if (status === 'PAID') {
    return 'bg-green-50 text-green-700'
  }

  if (status === 'OVERDUE') {
    return 'bg-red-50 text-red-700'
  }

  return 'bg-yellow-50 text-yellow-700'
}

export default function FinancesManager({ summaries, clients, invoices, expenses }: FinancesManagerProps) {
  const router = useRouter()

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false)
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)
  const [expenseError, setExpenseError] = useState<string | null>(null)
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false)
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false)

  const [invoiceTitle, setInvoiceTitle] = useState('')
  const [invoiceClientId, setInvoiceClientId] = useState('')
  const [invoiceAmount, setInvoiceAmount] = useState('')
  const [invoiceType, setInvoiceType] = useState<(typeof invoiceTypes)[number]>('ONE_TIME')
  const [invoiceStatus, setInvoiceStatus] = useState<(typeof invoiceStatuses)[number]>('PENDING')
  const [invoiceDueDate, setInvoiceDueDate] = useState('')
  const [invoiceNotes, setInvoiceNotes] = useState('')

  const [expenseTitle, setExpenseTitle] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseType, setExpenseType] = useState<(typeof expenseTypes)[number]>('ONE_TIME')
  const [expenseCategory, setExpenseCategory] = useState<(typeof expenseCategories)[number]>('OTHER')
  const [expensePaidDate, setExpensePaidDate] = useState('')
  const [expenseNextDue, setExpenseNextDue] = useState('')
  const [expenseNotes, setExpenseNotes] = useState('')

  const clientNameMap = useMemo(() => {
    return new Map(clients.map((client) => [client.id, client.name]))
  }, [clients])

  const closeInvoiceModal = () => {
    setIsInvoiceModalOpen(false)
    setInvoiceError(null)
    setInvoiceTitle('')
    setInvoiceClientId('')
    setInvoiceAmount('')
    setInvoiceType('ONE_TIME')
    setInvoiceStatus('PENDING')
    setInvoiceDueDate('')
    setInvoiceNotes('')
  }

  const closeExpenseModal = () => {
    setIsExpenseModalOpen(false)
    setEditingExpenseId(null)
    setExpenseError(null)
    setExpenseTitle('')
    setExpenseAmount('')
    setExpenseType('ONE_TIME')
    setExpenseCategory('OTHER')
    setExpensePaidDate('')
    setExpenseNextDue('')
    setExpenseNotes('')
  }

  const handleOpenEditExpense = (expense: ExpenseItem) => {
    setEditingExpenseId(expense.id)
    setExpenseError(null)
    setExpenseTitle(expense.title)
    setExpenseAmount(String(expense.amount))
    setExpenseType(expense.type as (typeof expenseTypes)[number])
    setExpenseCategory(expense.category as (typeof expenseCategories)[number])
    setExpensePaidDate(expense.paid_date ? expense.paid_date.slice(0, 10) : '')
    setExpenseNextDue(expense.next_due ? expense.next_due.slice(0, 10) : '')
    setExpenseNotes(expense.notes ?? '')
    setIsExpenseModalOpen(true)
  }

  const handleCreateInvoice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInvoiceError(null)
    setIsSubmittingInvoice(true)

    try {
      const response = await fetch('/api/admin/finances/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: invoiceTitle,
          client_id: invoiceClientId || null,
          amount: Number(invoiceAmount),
          type: invoiceType,
          status: invoiceStatus,
          due_date: invoiceDueDate || null,
          notes: invoiceNotes || null,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setInvoiceError(result.error ?? 'Failed to create invoice')
        setIsSubmittingInvoice(false)
        return
      }

      closeInvoiceModal()
      router.refresh()
    } catch {
      setInvoiceError('Failed to create invoice')
      setIsSubmittingInvoice(false)
    }
  }

  const handleCreateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setExpenseError(null)
    setIsSubmittingExpense(true)

    try {
      const response = await fetch('/api/admin/finances/expenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          type: expenseType,
          category: expenseCategory,
          paid_date: expensePaidDate || null,
          next_due: expenseNextDue || null,
          notes: expenseNotes || null,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setExpenseError(result.error ?? 'Failed to create expense')
        setIsSubmittingExpense(false)
        return
      }

      closeExpenseModal()
      router.refresh()
    } catch {
      setExpenseError('Failed to create expense')
      setIsSubmittingExpense(false)
    }
  }

  const handleUpdateExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingExpenseId) {
      return
    }

    setExpenseError(null)
    setIsSubmittingExpense(true)

    try {
      const response = await fetch(`/api/admin/finances/expenses/${editingExpenseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: expenseTitle,
          amount: Number(expenseAmount),
          type: expenseType,
          category: expenseCategory,
          paid_date: expensePaidDate || null,
          next_due: expenseNextDue || null,
          notes: expenseNotes || null,
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        setExpenseError(result.error ?? 'Failed to update expense')
        setIsSubmittingExpense(false)
        return
      }

      closeExpenseModal()
      router.refresh()
    } catch {
      setExpenseError('Failed to update expense')
      setIsSubmittingExpense(false)
    }
  }

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      const response = await fetch(`/api/admin/finances/invoices/${invoiceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PAID',
          paid_date: new Date().toISOString(),
        }),
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  const handleDeleteInvoice = async (invoiceId: string) => {
    const confirmed = window.confirm('Delete this invoice?')

    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/admin/finances/invoices/${invoiceId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    const confirmed = window.confirm('Delete this expense?')

    if (!confirmed) {
      return
    }

    try {
      const response = await fetch(`/api/admin/finances/expenses/${expenseId}`, {
        method: 'DELETE',
      })

      const result = (await response.json()) as ApiResponse

      if (!response.ok || !result.success) {
        return
      }

      router.refresh()
    } catch {
      return
    }
  }

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-sans text-3xl font-semibold tracking-tight text-slate-900">Finances</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaries.map((summary) => (
          <article key={summary.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">{summary.label}</p>
            <p className="mt-3 font-sans text-3xl font-semibold tracking-tight text-slate-900">
              {summary.value}
            </p>
          </article>
        ))}
      </div>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">Invoices</h2>
          <button
            type="button"
            onClick={() => setIsInvoiceModalOpen(true)}
            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add Invoice
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Due Date</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-10 text-center text-sm text-gray-500">
                    No invoices yet.
                  </td>
                </tr>
              ) : (
                invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="px-3 py-3 text-sm text-gray-900">{invoice.title}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">
                      {invoice.client_id ? clientNameMap.get(invoice.client_id) ?? 'Unknown Client' : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatCurrency(invoice.amount)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{invoice.type}</td>
                    <td className="px-3 py-3 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusClasses(invoice.status)}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatDate(invoice.due_date)}</td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        {invoice.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsPaid(invoice.id)}
                            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-600 hover:text-blue-600"
                          >
                            Mark Paid
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteInvoice(invoice.id)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-sans text-xl font-semibold tracking-tight text-gray-900">Expenses</h2>
          <button
            type="button"
            onClick={() => setIsExpenseModalOpen(true)}
            className="h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            Add Expense
          </button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Type</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Next Due</th>
                <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-gray-500">
                    No expenses yet.
                  </td>
                </tr>
              ) : (
                expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-3 py-3 text-sm text-gray-900">{expense.title}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{expense.category}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatCurrency(expense.amount)}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{expense.type}</td>
                    <td className="px-3 py-3 text-sm text-gray-700">{formatDate(expense.next_due)}</td>
                    <td className="px-3 py-3 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEditExpense(expense)}
                          className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-blue-600 hover:text-blue-600"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-sans text-xl font-semibold tracking-tight text-slate-900">Add Invoice</h3>
              <button
                type="button"
                onClick={closeInvoiceModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={handleCreateInvoice}>
              <div>
                <label htmlFor="invoice-title" className="text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="invoice-title"
                  value={invoiceTitle}
                  onChange={(event) => setInvoiceTitle(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  required
                />
              </div>

              <div>
                <label htmlFor="invoice-client" className="text-sm font-medium text-gray-700">
                  Client (Optional)
                </label>
                <select
                  id="invoice-client"
                  value={invoiceClientId}
                  onChange={(event) => setInvoiceClientId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                >
                  <option value="">No Client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="invoice-amount" className="text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    id="invoice-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={invoiceAmount}
                    onChange={(event) => setInvoiceAmount(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="invoice-type" className="text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    id="invoice-type"
                    value={invoiceType}
                    onChange={(event) => setInvoiceType(event.target.value as (typeof invoiceTypes)[number])}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  >
                    {invoiceTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="invoice-status" className="text-sm font-medium text-gray-700">
                    Status
                  </label>
                  <select
                    id="invoice-status"
                    value={invoiceStatus}
                    onChange={(event) => setInvoiceStatus(event.target.value as (typeof invoiceStatuses)[number])}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  >
                    {invoiceStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="invoice-due-date" className="text-sm font-medium text-gray-700">
                    Due Date
                  </label>
                  <input
                    id="invoice-due-date"
                    type="date"
                    value={invoiceDueDate}
                    onChange={(event) => setInvoiceDueDate(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="invoice-notes" className="text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="invoice-notes"
                  value={invoiceNotes}
                  onChange={(event) => setInvoiceNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                />
              </div>

              {invoiceError && <p className="text-sm text-red-600">{invoiceError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeInvoiceModal}
                  className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingInvoice}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingInvoice ? 'Saving...' : 'Create Invoice'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-sans text-xl font-semibold tracking-tight text-slate-900">
                {editingExpenseId ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button
                type="button"
                onClick={closeExpenseModal}
                className="rounded-md px-2 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              >
                Close
              </button>
            </div>

            <form className="mt-5 space-y-4" onSubmit={editingExpenseId ? handleUpdateExpense : handleCreateExpense}>
              <div>
                <label htmlFor="expense-title" className="text-sm font-medium text-gray-700">
                  Title
                </label>
                <input
                  id="expense-title"
                  value={expenseTitle}
                  onChange={(event) => setExpenseTitle(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="expense-amount" className="text-sm font-medium text-gray-700">
                    Amount
                  </label>
                  <input
                    id="expense-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="expense-type" className="text-sm font-medium text-gray-700">
                    Type
                  </label>
                  <select
                    id="expense-type"
                    value={expenseType}
                    onChange={(event) => setExpenseType(event.target.value as (typeof expenseTypes)[number])}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  >
                    {expenseTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="expense-category" className="text-sm font-medium text-gray-700">
                    Category
                  </label>
                  <select
                    id="expense-category"
                    value={expenseCategory}
                    onChange={(event) => setExpenseCategory(event.target.value as (typeof expenseCategories)[number])}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  >
                    {expenseCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="expense-paid-date" className="text-sm font-medium text-gray-700">
                    Paid Date
                  </label>
                  <input
                    id="expense-paid-date"
                    type="date"
                    value={expensePaidDate}
                    onChange={(event) => setExpensePaidDate(event.target.value)}
                    className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="expense-next-due" className="text-sm font-medium text-gray-700">
                  Next Due
                </label>
                <input
                  id="expense-next-due"
                  type="date"
                  value={expenseNextDue}
                  onChange={(event) => setExpenseNextDue(event.target.value)}
                  className="mt-2 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                />
              </div>

              <div>
                <label htmlFor="expense-notes" className="text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  id="expense-notes"
                  value={expenseNotes}
                  onChange={(event) => setExpenseNotes(event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-blue-600"
                />
              </div>

              {expenseError && <p className="text-sm text-red-600">{expenseError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeExpenseModal}
                  className="h-10 rounded-lg border border-gray-200 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingExpense}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingExpense ? 'Saving...' : editingExpenseId ? 'Save Expense' : 'Create Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}
