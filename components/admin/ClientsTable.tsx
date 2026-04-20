'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import ClientStatusSelect from '@/components/admin/ClientStatusSelect'
import DeleteClientButton from '@/components/admin/DeleteClientButton'
import EditClientModal from '@/components/admin/EditClientModal'

interface ClientListItem {
  id: string
  name: string | null
  email: string | null
  phone: string | null
  contact_names: string | null
  notes: string | null
  status: string
  createdLabel: string
  lastLoginLabel: string
  portalPages: string[]
}

interface ClientsTableProps {
  clients: ClientListItem[]
}

function statusBadgeClass(status: string) {
  switch (status.toUpperCase()) {
    case 'ACTIVE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'LEAD':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    case 'INACTIVE':
      return 'border-slate-200 bg-slate-100 text-slate-700'
    case 'ON_HOLD':
      return 'border-orange-200 bg-orange-50 text-orange-700'
    case 'ARCHIVED':
      return 'border-purple-200 bg-purple-50 text-purple-700'
    default:
      return 'border-gray-200 bg-gray-100 text-gray-700'
  }
}

export default function ClientsTable({ clients }: ClientsTableProps) {
  const [search, setSearch] = useState('')

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return clients
    }

    return clients.filter((client) =>
      [client.name, client.email, client.contact_names, client.notes]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(query))
    )
  }, [clients, search])

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
        <label htmlFor="client-search" className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
          Search clients
        </label>
        <input
          id="client-search"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by client name"
          className="mt-2 h-11 w-full max-w-md rounded-lg border border-gray-300 px-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="m-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="font-sans text-lg font-semibold tracking-tight text-gray-900">No matching clients</p>
          <p className="mt-2 text-sm text-gray-500">Try a different name or clear the search.</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-100 xl:hidden">
            {filteredClients.map((client) => (
              <details key={client.id} className="px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{client.name ?? 'Unnamed client'}</p>
                    <p className="truncate text-xs text-gray-500">{client.email ?? 'No email on file'}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(client.status)}`}>
                    {client.status.replace('_', ' ')}
                  </span>
                </summary>

                <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Phone</p>
                    <p className="mt-1 text-sm text-gray-700 break-words">{client.phone ?? '—'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Names of People</p>
                    <p className="mt-1 text-sm text-gray-700 break-words">{client.contact_names ?? '—'}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Portal Config</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {client.portalPages.length > 0 ? (
                        client.portalPages.map((page) => (
                          <span key={page} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                            {page}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                          No pages enabled
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Logged In</p>
                    <p className="mt-1 text-sm text-gray-600">{client.lastLoginLabel}</p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Date Created</p>
                    <p className="mt-1 text-sm text-gray-600">{client.createdLabel}</p>
                  </div>

                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</p>
                    <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700"
                    >
                      Manage
                    </Link>
                    <EditClientModal
                      clientId={client.id}
                      currentName={client.name}
                      currentEmail={client.email}
                      currentPhone={client.phone}
                      currentContactNames={client.contact_names}
                      currentNotes={client.notes}
                    />
                    <DeleteClientButton clientId={client.id} clientName={client.name ?? 'this client'} />
                  </div>
                </div>
              </details>
            ))}
          </div>

          <div className="hidden xl:block">
            <div className="grid grid-cols-7 gap-4 border-b border-gray-100 px-6 py-4">
              {['Name', 'Contact', 'Portal Config', 'Status', 'Last Logged In', 'Date Created', 'Actions'].map((label) => (
                <p key={label} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </p>
              ))}
            </div>

            <div className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <div key={client.id} className="grid grid-cols-7 gap-4 px-6 py-4">
                  <div className="min-w-0">
                    <Link href={`/admin/clients/${client.id}`} className="text-sm font-semibold text-slate-900 transition hover:text-blue-600">
                      {client.name ?? 'Unnamed client'}
                    </Link>
                    <p className="mt-1 text-sm text-gray-600 break-words">{client.notes ?? '—'}</p>
                  </div>

                  <div className="min-w-0 text-sm text-gray-700">
                    <p className="break-words">{client.email ?? '—'}</p>
                    <p className="mt-1 break-words">{client.phone ?? '—'}</p>
                    <p className="mt-1 break-words text-gray-500">{client.contact_names ?? '—'}</p>
                  </div>

                  <div className="flex flex-wrap content-start gap-2">
                    {client.portalPages.length > 0 ? (
                      client.portalPages.map((page) => (
                        <span key={page} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                          {page}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full border border-gray-200 bg-gray-100 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                        No pages enabled
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${statusBadgeClass(client.status)}`}>
                      {client.status.replace('_', ' ')}
                    </span>
                    <ClientStatusSelect clientId={client.id} currentStatus={client.status} />
                  </div>

                  <div className="text-sm text-gray-600">{client.lastLoginLabel}</div>
                  <div className="text-sm text-gray-600">{client.createdLabel}</div>

                  <div className="flex flex-wrap items-start gap-2">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700"
                    >
                      Manage
                    </Link>
                    <EditClientModal
                      clientId={client.id}
                      currentName={client.name}
                      currentEmail={client.email}
                      currentPhone={client.phone}
                      currentContactNames={client.contact_names}
                      currentNotes={client.notes}
                    />
                    <DeleteClientButton clientId={client.id} clientName={client.name ?? 'this client'} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}
