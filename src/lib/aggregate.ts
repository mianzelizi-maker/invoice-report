import type { Group, Row, Totals } from '../types'

export function sumRows(rows: Row[]): Totals {
  const t = { adSpend: 0, inquiries: 0, conversions: 0, monthlyFee: 0, outsourcingCost: 0 }
  for (const r of rows) {
    t.adSpend += r.adSpend
    t.inquiries += r.inquiries
    t.conversions += r.conversions
    t.monthlyFee += r.monthlyFee
    t.outsourcingCost += r.outsourcingCost
  }
  const grossProfit = t.monthlyFee - t.outsourcingCost
  return {
    ...t,
    grossProfit,
    grossMargin: t.monthlyFee > 0 ? grossProfit / t.monthlyFee : null,
    cpa: t.conversions > 0 && t.adSpend > 0 ? t.adSpend / t.conversions : null,
  }
}

export function groupBy(rows: Row[], pick: (r: Row) => string): Group[] {
  const map = new Map<string, Row[]>()
  for (const r of rows) {
    const k = pick(r)
    const list = map.get(k)
    if (list) list.push(r)
    else map.set(k, [r])
  }
  return [...map.entries()].map(([key, list]) => ({ key, totals: sumRows(list) }))
}

export const byClient = (rows: Row[]) => groupBy(rows, (r) => r.client)
export const byMedia = (rows: Row[]) => groupBy(rows, (r) => r.media)
export const byMonth = (rows: Row[]) =>
  groupBy(rows, (r) => r.month).sort((a, b) => a.key.localeCompare(b.key))

export const uniqueSorted = (rows: Row[], pick: (r: Row) => string) =>
  [...new Set(rows.map(pick))].sort((a, b) => a.localeCompare(b, 'ja'))

/** 前月の値との比較。改善/悪化の向きは呼び出し側で判断する */
export function prevMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function change(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null
  return (cur - prev) / Math.abs(prev)
}
