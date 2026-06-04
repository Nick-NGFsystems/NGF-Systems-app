'use client'

// Zero-dependency SVG charts for the finances Overview. No charting library —
// plain SVG + Tailwind, with lightweight hover tooltips. Dynamic geometry
// (stroke-dasharray, bar heights) uses inline style, which is the sanctioned
// exception to the Tailwind-only rule (genuinely dynamic values from JS).

import { useState } from 'react'
import { formatCurrency, formatCurrencyShort } from './format'

export interface Segment {
  label: string
  value: number
  color: string
}

/** A palette that stays readable on white; reused for categories. */
export const CHART_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#f59e0b', // amber
  '#db2777', // pink
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#dc2626', // red
  '#65a30d', // lime
  '#9333ea', // purple
  '#0d9488', // teal
  '#9ca3af', // gray (Other)
]

// ── Donut chart ────────────────────────────────────────────────────────────

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: Segment[]
  centerLabel?: string
  centerValue?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const total = segments.reduce((s, x) => s + x.value, 0)

  if (total <= 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No data to chart yet.
      </div>
    )
  }

  const size = 180
  const stroke = 26
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {segments.map((seg, i) => {
            const frac = seg.value / total
            const dash = frac * c
            const circle = (
              <circle
                key={seg.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={active === i ? stroke + 4 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-offset}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                className="cursor-pointer transition-[stroke-width]"
              />
            )
            offset += dash
            return circle
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {active !== null ? (
            <>
              <span className="text-xs text-gray-500">{segments[active].label}</span>
              <span className="font-sans text-lg font-semibold text-slate-900">
                {formatCurrency(segments[active].value)}
              </span>
              <span className="text-xs text-gray-400">
                {Math.round((segments[active].value / total) * 100)}%
              </span>
            </>
          ) : (
            <>
              <span className="text-xs text-gray-500">{centerLabel ?? 'Total'}</span>
              <span className="font-sans text-lg font-semibold text-slate-900">
                {formatCurrency(centerValue ?? total)}
              </span>
            </>
          )}
        </div>
      </div>

      <ul className="w-full space-y-1.5 sm:flex-1">
        {segments.map((seg, i) => (
          <li
            key={seg.label}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm ${active === i ? 'bg-gray-50' : ''}`}
          >
            <span className="flex items-center gap-2 text-gray-700">
              <span className="h-3 w-3 flex-shrink-0 rounded-sm" style={{ backgroundColor: seg.color }} />
              {seg.label}
            </span>
            <span className="tabular-nums text-gray-900">
              {formatCurrency(seg.value)}
              <span className="ml-2 text-xs text-gray-400">{Math.round((seg.value / total) * 100)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Grouped monthly bars (income vs expense) ─────────────────────────────────

export interface MonthDatum {
  label: string
  income: number
  expense: number
}

export function MonthlyBars({ data }: { data: MonthDatum[] }) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)))
  const chartH = 160

  if (data.every((d) => d.income === 0 && d.expense === 0)) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-gray-400">
        No income or expenses recorded in this range yet.
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-green-500" /> Income</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-500" /> Expenses</span>
      </div>
      <div className="relative flex items-end justify-between gap-1" style={{ height: chartH }}>
        {data.map((d, i) => {
          const net = d.income - d.expense
          return (
            <div
              key={`${d.label}-${i}`}
              className="group relative flex flex-1 items-end justify-center gap-0.5"
              style={{ height: chartH }}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
            >
              <div
                className="w-1/2 max-w-[14px] rounded-t bg-green-500/90"
                style={{ height: `${(d.income / max) * (chartH - 8)}px` }}
              />
              <div
                className="w-1/2 max-w-[14px] rounded-t bg-red-500/90"
                style={{ height: `${(d.expense / max) * (chartH - 8)}px` }}
              />
              {active === i && (
                <div className="absolute bottom-full z-10 mb-1 w-36 -translate-x-0 rounded-lg border border-gray-200 bg-white p-2 text-xs shadow-lg">
                  <p className="font-medium text-slate-900">{d.label}</p>
                  <p className="flex justify-between text-green-600"><span>Income</span><span className="tabular-nums">{formatCurrency(d.income)}</span></p>
                  <p className="flex justify-between text-red-600"><span>Expenses</span><span className="tabular-nums">{formatCurrency(d.expense)}</span></p>
                  <p className={`flex justify-between border-t border-gray-100 pt-1 ${net >= 0 ? 'text-slate-900' : 'text-red-600'}`}><span>Net</span><span className="tabular-nums">{formatCurrency(net)}</span></p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-[11px] text-gray-400">
        {data.map((d, i) => (
          <span key={`${d.label}-lbl-${i}`} className="flex-1 text-center">{d.label}</span>
        ))}
      </div>
      <p className="mt-1 text-right text-[11px] text-gray-400">peak {formatCurrencyShort(max)}/mo</p>
    </div>
  )
}

// ── Horizontal progress bar (budget allocations as dollars) ──────────────────

export function AllocationBar({
  label,
  percentage,
  dollars,
  color,
}: {
  label: string
  percentage: number
  dollars: number
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="tabular-nums text-gray-500">
          {percentage.toFixed(percentage % 1 === 0 ? 0 : 1)}%
          <span className="ml-2 text-gray-900">{formatCurrency(dollars)}</span>
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
