import Papa from 'papaparse'
import type { Invoice, Payment } from '../types'
import { receivable } from './aggregate'
import { normalizeDate, parseYen } from './csv'
import { normalizeForSearch } from './clientSearch'
import { paymentHistory } from './status'

/** 銀行の入金明細1行 */
export type Deposit = { id: number; date: string; payer: string; amount: number }

export type DepositIssue = { row: number; message: string }

const HEADERS = {
  date: ['入金日', '日付', 'date'],
  payer: ['振込名義', '振込人', '依頼人名', '名義', 'payer'],
  amount: ['金額', '入金額', 'amount'],
}

/** 入金明細CSV（入金日・振込名義・金額）を読む。読めない行は issues に理由を入れて除く */
export function parseDeposits(text: string): { deposits: Deposit[]; issues: DepositIssue[] } {
  const out = { deposits: [] as Deposit[], issues: [] as DepositIssue[] }
  const rows = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: true }).data.map((r) =>
    r.map((c) => c.normalize('NFKC').trim()),
  )
  if (rows.length === 0) {
    out.issues.push({ row: 0, message: 'ファイルが空です' })
    return out
  }
  const header = rows[0].map((h) => h.toLowerCase())
  const col = Object.fromEntries(
    Object.entries(HEADERS).map(([k, names]) => [k, header.findIndex((h) => names.includes(h))]),
  ) as Record<keyof typeof HEADERS, number>
  const missing = (Object.keys(HEADERS) as (keyof typeof HEADERS)[]).filter((k) => col[k] < 0)
  if (missing.length > 0) {
    const label = { date: '入金日', payer: '振込名義', amount: '金額' }
    out.issues.push({ row: 1, message: `列が見つかりません：${missing.map((k) => label[k]).join('、')}` })
    return out
  }
  rows.slice(1).forEach((cells, i) => {
    const row = i + 2
    const date = normalizeDate(cells[col.date] ?? '')
    const amount = parseYen(cells[col.amount] ?? '')
    const payer = cells[col.payer] ?? ''
    if (!date) return void out.issues.push({ row, message: `入金日を読めません：${cells[col.date] ?? ''}` })
    if (amount === null || amount <= 0) return void out.issues.push({ row, message: `金額を読めません（正の整数）：${cells[col.amount] ?? ''}` })
    if (!payer) return void out.issues.push({ row, message: '振込名義が空です' })
    out.deposits.push({ id: out.deposits.length + 1, date, payer, amount })
  })
  return out
}

/** 振込名義・取引先名を照合用にそろえる。（株）・カ) などの法人格と、全角半角・かな種別の違いを除く */
export function normalizePayer(s: string): string {
  return normalizeForSearch(s)
    .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|\(合\)/g, '')
    .replace(/^[カユゴ]\)|\([カユゴ]$/g, '')
    .replace(/[()・.\-_]/g, '')
}

export type MatchKind =
  | 'exact' // 残高とぴったり一致
  | 'partial' // 残高より少ない（一部入金）
  | 'multi' // 複数の請求書にまたがる（期日の古い順に充当）
  | 'over' // 残高の合計を超える（過入金の疑い）
  | 'unmatched' // 取引先を特定できない

export type Allocation = { invoiceNo: string; amount: number }

export type Match = {
  deposit: Deposit
  client: string | null
  kind: MatchKind
  allocations: Allocation[] // 消込候補。over / unmatched は空（人が確認する）
}

/** 振込名義から取引先を探す。名前・フリガナのどちらかが一致（部分一致）した中で、最も長く一致したもの */
export function findClient(payer: string, invoices: Invoice[]): string | null {
  const p = normalizePayer(payer)
  if (p.length < 2) return null
  let best: { client: string; score: number } | null = null
  const seen = new Map<string, Set<string>>()
  for (const inv of invoices) {
    const keys = seen.get(inv.client) ?? new Set<string>()
    keys.add(normalizePayer(inv.client))
    if (inv.clientKana) keys.add(normalizePayer(inv.clientKana))
    seen.set(inv.client, keys)
  }
  for (const [client, keys] of seen) {
    for (const k of keys) {
      if (k.length < 2) continue
      // 銀行の振込名義は文字数制限で途中で切れるため、前方一致も認める。それ以外の部分一致は認めない
      const score = p === k ? 1000 + k.length : k.startsWith(p) || p.startsWith(k) ? Math.min(p.length, k.length) : 0
      if (score > 0 && (!best || score > best.score)) best = { client, score }
    }
  }
  return best?.client ?? null
}

/**
 * 入金明細と未回収の請求書を突き合わせ、消込の候補を作る（入金日の古い順に処理）。
 * 同じ請求書に複数の入金が当たらないよう、充当した分は残高から引いていく。
 */
export function matchDeposits(deposits: Deposit[], invoices: Invoice[]): Match[] {
  const remaining = new Map(invoices.map((i) => [i.invoiceNo, receivable(i)]))
  const sorted = [...deposits].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
  const byId = new Map<number, Match>()

  for (const deposit of sorted) {
    const client = findClient(deposit.payer, invoices)
    const make = (kind: MatchKind, allocations: Allocation[] = []): Match => ({ deposit, client, kind, allocations })
    if (!client) {
      byId.set(deposit.id, make('unmatched'))
      continue
    }
    const open = invoices
      .filter((i) => i.client === client && (remaining.get(i.invoiceNo) ?? 0) > 0)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceNo.localeCompare(b.invoiceNo))
    const rem = (i: Invoice) => remaining.get(i.invoiceNo) ?? 0
    const total = open.reduce((s, i) => s + rem(i), 0)
    const apply = (kind: MatchKind, allocations: Allocation[]) => {
      for (const a of allocations) remaining.set(a.invoiceNo, (remaining.get(a.invoiceNo) ?? 0) - a.amount)
      byId.set(deposit.id, make(kind, allocations))
    }

    const exact = open.find((i) => rem(i) === deposit.amount)
    if (exact) apply('exact', [{ invoiceNo: exact.invoiceNo, amount: deposit.amount }])
    else if (open.length === 0 || deposit.amount > total) byId.set(deposit.id, make('over'))
    else if (deposit.amount < rem(open[0])) apply('partial', [{ invoiceNo: open[0].invoiceNo, amount: deposit.amount }])
    else {
      // 古い請求書から順に充当する
      const allocations: Allocation[] = []
      let left = deposit.amount
      for (const i of open) {
        if (left <= 0) break
        const take = Math.min(left, rem(i))
        allocations.push({ invoiceNo: i.invoiceNo, amount: take })
        left -= take
      }
      apply('multi', allocations)
    }
  }
  return deposits.map((d) => byId.get(d.id)!)
}

/** 消込を請求データに反映する。入金を履歴に1回分として追加し、入金額・最終入金日を更新する */
export function applyMatches(invoices: Invoice[], matches: Match[]): Invoice[] {
  const adds = new Map<string, Payment[]>()
  for (const m of matches) {
    for (const a of m.allocations) {
      const list = adds.get(a.invoiceNo) ?? []
      list.push({ date: m.deposit.date, amount: a.amount })
      adds.set(a.invoiceNo, list)
    }
  }
  return invoices.map((i) => {
    const added = adds.get(i.invoiceNo)
    if (!added) return i
    const payments = [...paymentHistory(i), ...added].sort((a, b) => a.date.localeCompare(b.date))
    return {
      ...i,
      payments,
      paidAmount: payments.reduce((sum, p) => sum + p.amount, 0),
      paidDate: payments[payments.length - 1].date,
    }
  })
}
