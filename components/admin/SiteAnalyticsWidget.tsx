'use client'

import { useEffect, useState } from 'react'

type AnalyticsData = {
  totals: { users: number; pageViews: number; sessions: number }
  topPages: { path: string; views: number; users: number }[]
  days: number
}

export default function SiteAnalyticsWidget() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/admin/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError('Failed to load analytics'))
      .finally(() => setLoading(false))
  }, [days])

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-sans text-base font-semibold text-gray-900">NGF Systems Website</h2>
          <p className="text-xs text-gray-400 mt-0.5">ngfsystems.com · Google Analytics</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value))}
          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-28 text-sm text-gray-400">
          Loading analytics…
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center h-28 text-sm text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: 'Users', value: data.totals.users.toLocaleString() },
              { label: 'Page Views', value: data.totals.pageViews.toLocaleString() },
              { label: 'Sessions', value: data.totals.sessions.toLocaleString() },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{stat.value}</p>
              </div>
            ))}
          </div>

          {data.topPages.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Top Pages</p>
              <ul className="space-y-1.5">
                {data.topPages.map((page) => (
                  <li key={page.path} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate max-w-[70%] font-mono text-xs">{page.path}</span>
                    <span className="text-gray-500 text-xs">{page.views.toLocaleString()} views</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
