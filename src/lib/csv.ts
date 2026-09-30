import Papa from 'papaparse'
import type { Row } from '../types'

// Step 4 で列不足・非数値などの検証を追加する。いまは最低限の読み込みのみ。
export function parseCsv(text: string): Row[] {
  const res = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
  return res.data.map((r) => ({
    month: r.month,
    client: r.client,
    media: r.media,
    adSpend: Number(r.ad_spend),
    inquiries: Number(r.inquiries),
    conversions: Number(r.conversions),
    monthlyFee: Number(r.monthly_fee),
    outsourcingCost: Number(r.outsourcing_cost),
  }))
}

export async function loadSample(): Promise<Row[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}sample.csv`)
  if (!res.ok) throw new Error('サンプルデータを読み込めませんでした')
  return parseCsv(await res.text())
}
