import type { Invoice } from '../types'
import { AGING_BUCKETS, agingBucket, balance, isOverdue, lateDays, overdueDays, paymentHistory, type AgingBucket } from './status'

/** 売掛金として扱う残高。過入金（マイナス残高）は売掛金に含めない */
export const receivable = (inv: Invoice): number => Math.max(0, balance(inv))

export const monthOf = (date: string): string => date.slice(0, 7)

export type Summary = {
  invoiceCount: number
  billed: number // 請求総額
  collected: number // 入金総額（請求額を上限）
  ar: number // 売掛金残高
  overdueAmount: number // 支払遅延の残高
  overdueCount: number
  dueThisMonthAmount: number // 今月が期日で未回収の残高（遅延中を含む）
  dueThisMonthCount: number
  collectionRate: number | null // 期日到来分の回収率。期日到来分がなければ null
}

export function summarize(invoices: Invoice[], asOf: string): Summary {
  const month = monthOf(asOf)
  const s: Summary = {
    invoiceCount: invoices.length, billed: 0, collected: 0, ar: 0, overdueAmount: 0, overdueCount: 0,
    dueThisMonthAmount: 0, dueThisMonthCount: 0, collectionRate: null,
  }
  let dueBilled = 0
  let dueCollected = 0
  for (const inv of invoices) {
    const ar = receivable(inv)
    const collected = Math.min(inv.paidAmount, inv.amount)
    s.billed += inv.amount
    s.collected += collected
    s.ar += ar
    if (isOverdue(inv, asOf)) {
      s.overdueAmount += ar
      s.overdueCount++
    }
    if (ar > 0 && monthOf(inv.dueDate) === month) {
      s.dueThisMonthAmount += ar
      s.dueThisMonthCount++
    }
    if (inv.dueDate <= asOf) {
      dueBilled += inv.amount
      dueCollected += collected
    }
  }
  s.collectionRate = dueBilled > 0 ? dueCollected / dueBilled : null
  return s
}

export type ClientSummary = {
  client: string
  invoiceCount: number
  billed: number
  ar: number
  overdueAmount: number
  overdueCount: number
  maxOverdueDays: number
  hasPartialOverdue: boolean // 一部入金のうえ遅延している請求書がある
  lateCount: number // 遅延が発生した請求書数（遅れて入金済み＋現在遅延中）
  evaluableCount: number // 遅延の有無を判断できる請求書数（期日到来済み、または入金済み）
  lateRate: number | null
  avgLateDays: number | null // 遅延が発生した請求書の平均遅延日数
}

export function byClient(invoices: Invoice[], asOf: string): ClientSummary[] {
  const map = new Map<string, Invoice[]>()
  for (const inv of invoices) {
    const list = map.get(inv.client)
    if (list) list.push(inv)
    else map.set(inv.client, [inv])
  }
  return [...map.entries()].map(([client, list]) => {
    const sum = summarize(list, asOf)
    const late = list.map((i) => lateDays(i, asOf)).filter((d) => d > 0)
    const evaluable = list.filter((i) => i.dueDate <= asOf || balance(i) <= 0).length
    return {
      client,
      invoiceCount: list.length,
      billed: sum.billed,
      ar: sum.ar,
      overdueAmount: sum.overdueAmount,
      overdueCount: sum.overdueCount,
      maxOverdueDays: Math.max(0, ...list.map((i) => overdueDays(i, asOf))),
      hasPartialOverdue: list.some((i) => isOverdue(i, asOf) && i.paidAmount > 0),
      lateCount: late.length,
      evaluableCount: evaluable,
      lateRate: evaluable > 0 ? late.length / evaluable : null,
      avgLateDays: late.length > 0 ? late.reduce((a, b) => a + b, 0) / late.length : null,
    }
  })
}

/** 回収を急ぐべき取引先：現在遅延中の残高が大きい順。現在の遅延がない取引先は除く */
export function rankByOverdueAmount(clients: ClientSummary[], limit = 5): ClientSummary[] {
  return clients
    .filter((c) => c.overdueAmount > 0)
    .sort((a, b) => b.overdueAmount - a.overdueAmount || b.maxOverdueDays - a.maxOverdueDays)
    .slice(0, limit)
}

/** 支払いが遅れがちな取引先：遅延回数が多い順（同数なら平均遅延日数が長い順）。遅延が一度もない取引先は除く */
export function rankByDelay(clients: ClientSummary[], limit = 5): ClientSummary[] {
  return clients
    .filter((c) => c.lateCount > 0)
    .sort(
      (a, b) =>
        b.lateCount - a.lateCount ||
        (b.avgLateDays ?? 0) - (a.avgLateDays ?? 0) ||
        b.overdueAmount - a.overdueAmount,
    )
    .slice(0, limit)
}

/** 売掛金残高が大きい順 */
export const rankByReceivable = (clients: ClientSummary[]): ClientSummary[] =>
  [...clients].filter((c) => c.ar > 0).sort((a, b) => b.ar - a.ar)

export type AgingRow = { bucket: AgingBucket; amount: number; count: number }

/** 未回収残高を、期日からの経過日数の区分ごとに集計する */
export function aging(invoices: Invoice[], asOf: string): AgingRow[] {
  const rows = AGING_BUCKETS.map((bucket) => ({ bucket, amount: 0, count: 0 }))
  for (const inv of invoices) {
    const ar = receivable(inv)
    if (ar <= 0) continue
    const row = rows.find((r) => r.bucket === agingBucket(overdueDays(inv, asOf)))!
    row.amount += ar
    row.count++
  }
  return rows
}

/** 指定日時点の売掛金残高（請求日が当日以前で、入金日が当日より後または未入金のもの） */
export function arAt(invoices: Invoice[], date: string): number {
  let total = 0
  for (const inv of invoices) {
    if (inv.issueDate > date) continue
    const paid = paymentHistory(inv).reduce((sum, p) => (p.date <= date ? sum + p.amount : sum), 0)
    total += Math.max(0, inv.amount - paid)
  }
  return total
}

export type MonthRow = { month: string; billed: number; collected: number; ar: number }

/** 月別の請求額（請求日ベース）・入金額（入金日ベース）・月末売掛金残高。基準日の月まで */
export function byMonth(invoices: Invoice[], asOf: string): MonthRow[] {
  const rows = new Map<string, MonthRow>()
  const row = (month: string) => {
    let r = rows.get(month)
    if (!r) rows.set(month, (r = { month, billed: 0, collected: 0, ar: 0 }))
    return r
  }
  for (const inv of invoices) {
    row(monthOf(inv.issueDate)).billed += inv.amount
    // 入金ごとに入金月へ計上する（請求額を超える分は数えない）
    let counted = 0
    for (const p of paymentHistory(inv)) {
      const credit = Math.min(p.amount, inv.amount - counted)
      if (credit <= 0) continue
      row(monthOf(p.date)).collected += credit
      counted += credit
    }
  }
  const cutoff = monthOf(asOf)
  const result = [...rows.values()].filter((r) => r.month <= cutoff).sort((a, b) => a.month.localeCompare(b.month))
  for (const r of result) {
    const [y, m] = r.month.split('-').map(Number)
    const monthEnd = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
    r.ar = arAt(invoices, monthEnd < asOf ? monthEnd : asOf)
  }
  return result
}

/** 指定した月（YYYY-MM）が期日で未回収の請求書（期日の早い順） */
export function dueInMonth(invoices: Invoice[], month: string): Invoice[] {
  return invoices
    .filter((i) => receivable(i) > 0 && monthOf(i.dueDate) === month)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

/** 今月が期日で未回収の請求書（期日の早い順） */
export const dueThisMonth = (invoices: Invoice[], asOf: string): Invoice[] => dueInMonth(invoices, monthOf(asOf))

/** 基準日の翌月（YYYY-MM） */
export function nextMonthOf(asOf: string): string {
  const [y, m] = asOf.split('-').map(Number)
  const d = new Date(Date.UTC(y, m, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export function change(cur: number, prev: number): number | null {
  return prev === 0 ? null : (cur - prev) / prev
}

/** 前月末の日付（YYYY-MM-DD）。基準日が属する月の前月末 */
export function prevMonthEnd(asOf: string): string {
  const [y, m] = asOf.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
}
