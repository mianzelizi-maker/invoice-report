import type { DisplayStatus, Invoice, PaymentStatus } from '../types'

const MS_PER_DAY = 86_400_000

/** YYYY-MM-DD を UTC の日付として扱う（タイムゾーンによるズレを避ける） */
export function parseDate(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

/** to - from の日数（to が後なら正） */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to) - parseDate(from)) / MS_PER_DAY)
}

export const balance = (inv: Invoice): number => inv.amount - inv.paidAmount

export function paymentStatus(inv: Invoice): PaymentStatus {
  if (balance(inv) <= 0) return '入金済み'
  return inv.paidAmount > 0 ? '一部入金' : '未入金'
}

/** 残高があり、支払期日が基準日より前なら遅延（期日当日は遅延ではない） */
export function isOverdue(inv: Invoice, asOf: string): boolean {
  return balance(inv) > 0 && inv.dueDate < asOf
}

export function displayStatus(inv: Invoice, asOf: string): DisplayStatus {
  return isOverdue(inv, asOf) ? '支払遅延' : paymentStatus(inv)
}

/**
 * 画面表示用のラベル。一部入金のうえ遅延している請求書は「一部入金・遅延」として、
 * 一部入金されていることも分かるようにする（それ以外は displayStatus と同じ）。
 */
export function statusLabel(inv: Invoice, asOf: string): string {
  const st = displayStatus(inv, asOf)
  return st === '支払遅延' && inv.paidAmount > 0 ? '一部入金・遅延' : st
}

/** 未回収分の遅延日数（基準日 − 期日）。遅延していなければ 0 */
export function overdueDays(inv: Invoice, asOf: string): number {
  return isOverdue(inv, asOf) ? daysBetween(inv.dueDate, asOf) : 0
}

/**
 * その請求書で実際に発生した遅延日数。
 * 未回収は基準日まで、入金済みは入金日が期日を過ぎた日数（取引先の遅延傾向の集計用）。
 */
export function lateDays(inv: Invoice, asOf: string): number {
  if (balance(inv) > 0) return overdueDays(inv, asOf)
  return inv.paidDate ? Math.max(0, daysBetween(inv.dueDate, inv.paidDate)) : 0
}

export type AgingBucket = '期日内' | '1〜30日' | '31〜60日' | '61日超'
export const AGING_BUCKETS: AgingBucket[] = ['期日内', '1〜30日', '31〜60日', '61日超']

export function agingBucket(days: number): AgingBucket {
  if (days <= 0) return '期日内'
  if (days <= 30) return '1〜30日'
  if (days <= 60) return '31〜60日'
  return '61日超'
}
