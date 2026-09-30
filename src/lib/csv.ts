import Papa from 'papaparse'
import type { Invoice } from '../types'

/** サンプルデータが再現している基準日（この日付で見ると毎回同じ結果になる） */
export const SAMPLE_AS_OF = '2026-09-30'

type Key = 'client' | 'invoiceNo' | 'issueDate' | 'amount' | 'dueDate' | 'paidDate' | 'paidAmount'

/** 列の定義：画面に出す名前、受け付けるヘッダー名（小文字化して比較）、説明 */
export const COLUMNS: { key: Key; label: string; aliases: string[]; example: string; note: string }[] = [
  { key: 'client', label: '取引先', aliases: ['client', '取引先', '取引先名', '顧客'], example: '丸山製作所', note: '空にできません' },
  { key: 'invoiceNo', label: '請求番号', aliases: ['invoice_no', '請求番号', '請求書番号'], example: 'INV-202609-001', note: '重複できません' },
  { key: 'issueDate', label: '請求日', aliases: ['issue_date', '請求日', '発行日'], example: '2026-09-30', note: 'YYYY-MM-DD または YYYY/MM/DD' },
  { key: 'amount', label: '請求額', aliases: ['amount', '請求額', '請求金額'], example: '520300', note: '税込の円。1円以上の整数' },
  { key: 'dueDate', label: '支払期日', aliases: ['due_date', '支払期日', '支払期限', '期日'], example: '2026-10-30', note: '請求日以降の日付' },
  { key: 'paidDate', label: '入金日', aliases: ['paid_date', '入金日'], example: '2026-10-28', note: '未入金なら空。入金額があれば必須' },
  { key: 'paidAmount', label: '入金額', aliases: ['paid_amount', '入金額', '入金金額'], example: '520300', note: '未入金なら空か0。請求額を超えられません' },
]
const LABEL = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label])) as Record<Key, string>
const REQUIRED: Key[] = COLUMNS.map((c) => c.key) // 列そのものは全て必要（値は入金日・入金額のみ空欄可）

export type CsvIssue = {
  row: number // ファイル内の行番号（見出し行が1行目）。0は行に紐づかない問題
  column: string
  message: string
  value: string
}

export type ParseResult = {
  invoices: Invoice[] // 誤りのない行だけ
  issues: CsvIssue[]
  totalRows: number // 空行を除いたデータ行数
  invalidRows: number
  fatal: boolean // 列不足・空ファイルなど、取り込みを続けられない問題がある
}

/** UTF-8 として読めなければ Shift_JIS（Excel の「CSV」保存）として読む */
export function decodeBytes(buf: ArrayBuffer | Uint8Array): string {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder('shift_jis').decode(buf)
  }
  return text.replace(/^﻿/, '')
}

/** 2026/9/5 や 2026-09-05 を YYYY-MM-DD にそろえる。実在しない日付は null */
export function normalizeDate(s: string): string | null {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s)
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return `${m[1]}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 「1,100,000」「¥5,000」「300円」などを整数に。整数として読めなければ null */
export function parseYen(s: string): number | null {
  const t = s.replace(/[\s,¥￥円]/g, '')
  return /^-?\d+$/.test(t) ? Number(t) : null
}

export function parseCsv(text: string): ParseResult {
  const result: ParseResult = { invoices: [], issues: [], totalRows: 0, invalidRows: 0, fatal: false }
  const issue = (row: number, column: string, message: string, value = '') =>
    result.issues.push({ row, column, message, value })

  const parsed = Papa.parse<string[]>(text.replace(/^﻿/, ''), { skipEmptyLines: false })
  // 全角数字・全角ハイフン・全角カンマなどを半角にそろえる
  const rows = parsed.data.map((r) => r.map((c) => c.normalize('NFKC').trim()))
  for (const e of parsed.errors) {
    if (e.type === 'Quotes') issue((e.row ?? 0) + 1, '—', 'ダブルクォートの対応が正しくありません')
  }

  const headerIdx = rows.findIndex((r) => r.some((c) => c !== ''))
  if (headerIdx < 0) {
    issue(0, '—', 'ファイルが空です')
    result.fatal = true
    return result
  }

  const header = rows[headerIdx].map((h) => h.toLowerCase())
  const col = {} as Record<Key, number>
  for (const c of COLUMNS) col[c.key] = header.findIndex((h) => c.aliases.includes(h))
  for (const key of REQUIRED) {
    if (col[key] < 0) {
      issue(headerIdx + 1, LABEL[key], `列「${LABEL[key]}」（または ${COLUMNS.find((c) => c.key === key)!.aliases[0]}）が見つかりません`)
      result.fatal = true
    }
  }
  if (result.fatal) return result

  const firstLineOfNo = new Map<string, number>()

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.every((c) => c === '')) continue // 空行
    const line = i + 1
    result.totalRows++
    const before = result.issues.length
    const get = (k: Key) => cells[col[k]] ?? ''

    if (cells.length > header.length) {
      issue(line, '—', `列数が見出しより多くなっています（${cells.length}列）。項目にカンマが含まれる場合は "" で囲んでください`)
    }

    const client = get('client')
    if (!client) issue(line, LABEL.client, '取引先が空です')

    const invoiceNo = get('invoiceNo')
    if (!invoiceNo) {
      issue(line, LABEL.invoiceNo, '請求番号が空です')
    } else if (firstLineOfNo.has(invoiceNo)) {
      issue(line, LABEL.invoiceNo, `請求番号が重複しています（${firstLineOfNo.get(invoiceNo)}行目と同じ）`, invoiceNo)
    } else {
      firstLineOfNo.set(invoiceNo, line)
    }

    const dateOf = (k: Key, required: boolean): string | null => {
      const raw = get(k)
      if (raw === '') {
        if (required) issue(line, LABEL[k], `${LABEL[k]}が空です`)
        return null
      }
      const d = normalizeDate(raw)
      if (!d) issue(line, LABEL[k], `${LABEL[k]}が日付として正しくありません（例: 2026-09-30）`, raw)
      return d
    }
    const issueDate = dateOf('issueDate', true)
    const dueDate = dateOf('dueDate', true)
    const paidDate = dateOf('paidDate', false)

    let amount: number | null = null
    const rawAmount = get('amount')
    if (rawAmount === '') {
      issue(line, LABEL.amount, '請求額が空です')
    } else {
      amount = parseYen(rawAmount)
      if (amount === null) issue(line, LABEL.amount, '請求額が数値ではありません', rawAmount)
      else if (amount <= 0) issue(line, LABEL.amount, '請求額は1円以上にしてください', rawAmount)
    }

    let paidAmount = 0
    let paidAmountBroken = false // 入金額そのものが誤りのとき、そこから派生する指摘は重ねない
    const rawPaid = get('paidAmount')
    if (rawPaid !== '') {
      const p = parseYen(rawPaid)
      if (p === null) {
        issue(line, LABEL.paidAmount, '入金額が数値ではありません', rawPaid)
        paidAmountBroken = true
      } else if (p < 0) {
        issue(line, LABEL.paidAmount, '入金額は0以上にしてください', rawPaid)
        paidAmountBroken = true
      } else paidAmount = p
    }

    // 項目どうしの整合
    if (issueDate && dueDate && dueDate < issueDate) {
      issue(line, LABEL.dueDate, '支払期日が請求日より前になっています', get('dueDate'))
    }
    if (amount !== null && amount > 0 && paidAmount > amount) {
      issue(line, LABEL.paidAmount, `入金額が請求額（${amount.toLocaleString('ja-JP')}円）を超えています`, rawPaid)
    }
    if (paidAmount > 0 && rawPaid !== '' && !get('paidDate')) {
      issue(line, LABEL.paidDate, '入金額があるのに入金日が空です')
    }
    if (get('paidDate') && paidDate && paidAmount === 0 && !paidAmountBroken) {
      issue(line, LABEL.paidAmount, '入金日があるのに入金額が空か0です')
    }
    if (issueDate && paidDate && paidDate < issueDate) {
      issue(line, LABEL.paidDate, '入金日が請求日より前になっています', get('paidDate'))
    }

    if (result.issues.length > before) {
      result.invalidRows++
    } else {
      result.invoices.push({
        client, invoiceNo, issueDate: issueDate!, amount: amount!, dueDate: dueDate!,
        paidDate: paidAmount > 0 ? paidDate : null, paidAmount,
      })
    }
  }

  if (result.totalRows === 0) {
    issue(0, '—', 'データ行がありません（見出し行のみです）')
    result.fatal = true
  }
  return result
}

export async function loadSample(): Promise<Invoice[]> {
  const res = await fetch(`${import.meta.env.BASE_URL}sample.csv`)
  if (!res.ok) throw new Error('サンプルデータを読み込めませんでした')
  const parsed = parseCsv(await res.text())
  if (parsed.issues.length > 0) throw new Error('サンプルデータの形式が正しくありません')
  return parsed.invoices
}

/** 誤りを含むデモ用CSVを読み込む（検証表示の確認用） */
export async function loadErrorDemo(): Promise<ParseResult> {
  const res = await fetch(`${import.meta.env.BASE_URL}sample-error.csv`)
  if (!res.ok) throw new Error('デモ用CSVを読み込めませんでした')
  return parseCsv(await res.text())
}
