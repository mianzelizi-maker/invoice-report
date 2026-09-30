import type { ReactNode } from 'react'
import { displayStatus, statusLabel } from '../lib/status'
import type { Invoice } from '../types'

export function Card({ title, note, children, className = '' }: {
  title?: string
  note?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl border border-line bg-card p-3 sm:p-4 ${className}`}>
      {title && <h3 className="text-sm font-bold text-navy">{title}</h3>}
      {note && <p className="text-xs text-muted">{note}</p>}
      {children}
    </section>
  )
}

const TONE = { normal: 'text-ink', bad: 'text-overdue', good: 'text-paid' }

export function Kpi({ label, value, sub, tone = 'normal' }: {
  label: string
  value: string
  sub?: string
  tone?: keyof typeof TONE
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-3 sm:p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-bold sm:text-2xl ${TONE[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

const BADGE: Record<string, string> = {
  入金済み: 'bg-paid/15 text-paid',
  一部入金: 'bg-amber/15 text-amber',
  未入金: 'bg-navy/10 text-navy',
  支払遅延: 'bg-overdue/15 text-overdue font-bold',
  // 一部入金されていることが分かるよう、遅延の赤に琥珀の枠を添える
  '一部入金・遅延': 'bg-overdue/15 text-overdue font-bold ring-1 ring-amber',
}

export function StatusBadge({ invoice, asOf }: { invoice: Invoice; asOf: string }) {
  const label = statusLabel(invoice, asOf)
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-xs ${BADGE[label]}`}>{label}</span>
  )
}

/** 絞り込み用の状態（一部入金のうえ遅延は「支払遅延」に含める） */
export const statusKey = (inv: Invoice, asOf: string) => displayStatus(inv, asOf)

export const th = 'px-3 py-2 text-left font-medium whitespace-nowrap'
export const thR = 'px-3 py-2 text-right font-medium whitespace-nowrap'
export const td = 'px-3 py-2 whitespace-nowrap'
export const tdR = 'px-3 py-2 text-right whitespace-nowrap'
