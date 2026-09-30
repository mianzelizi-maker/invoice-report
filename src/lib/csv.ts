import Papa from 'papaparse'
import type { Invoice } from '../types'

/** サンプルデータが再現している基準日（この日付で見ると毎回同じ結果になる） */
export const SAMPLE_AS_OF = '2026-09-30'

// Step 4 で列不足・日付不正・数値でない値などの検証を追加する。いまは最低限の読み込みのみ。
export function parseCsv(text: string): Invoice[] {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return res.data.map((r) => ({
    client: r.client,
    invoiceNo: r.invoice_no,
    issueDate: r.issue_date,
    amount: Number(r.amount),
    dueDate: r.due_date,
    paidDate: r.paid_date ? r.paid_date : null,
    paidAmount: r.paid_amount ? Number(r.paid_amount) : 0,
  }))
}

export async function loadSample(): Promise<Invoice[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}sample.csv`)
  if (!res.ok) throw new Error('サンプルデータを読み込めませんでした')
  return parseCsv(await res.text())
}
