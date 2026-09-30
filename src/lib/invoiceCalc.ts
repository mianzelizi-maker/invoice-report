/** 請求書（発行用）の計算・採番。金額はすべて円の整数 */

export type TaxRate = 10 | 8 | 0

export type LineInput = { name: string; qty: number; unitPrice: number; taxRate: TaxRate }
export type Line = LineInput & { amount: number }

export type TaxGroup = { rate: TaxRate; subtotal: number; tax: number }

export type Totals = {
  lines: Line[]
  groups: TaxGroup[] // 税率ごとの対象額と消費税（適格請求書の記載事項）
  subtotal: number // 税抜の合計
  tax: number // 消費税の合計
  total: number // 税込の合計
}

/** 明細1行の金額（数量×単価）。小数の数量でも円未満は四捨五入する */
export const lineAmount = (l: Pick<LineInput, 'qty' | 'unitPrice'>): number => Math.round(l.qty * l.unitPrice)

/**
 * 小計・消費税・合計の計算。
 * 消費税は「税率ごとに、対象額の合計に対して1回だけ」円未満を切り捨てる（明細ごとには端数処理しない）。
 */
export function calcInvoice(inputs: LineInput[]): Totals {
  const lines = inputs.map((l) => ({ ...l, amount: lineAmount(l) }))
  const groups: TaxGroup[] = ([10, 8, 0] as TaxRate[])
    .map((rate) => {
      const subtotal = lines.filter((l) => l.taxRate === rate).reduce((s, l) => s + l.amount, 0)
      return { rate, subtotal, tax: Math.floor((subtotal * rate) / 100) }
    })
    .filter((g) => lines.some((l) => l.taxRate === g.rate))
  const subtotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const tax = groups.reduce((s, g) => s + g.tax, 0)
  return { lines, groups, subtotal, tax, total: subtotal + tax }
}

/** 請求番号の自動採番：INV-YYYYMM-連番。同じ年月の既存の最大連番 + 1 */
export function nextInvoiceNo(existing: string[], issueDate: string): string {
  const ym = issueDate.slice(0, 7).replace('-', '')
  const prefix = `INV-${ym}-`
  let max = 0
  for (const no of existing) {
    if (!no.startsWith(prefix)) continue
    const n = Number(no.slice(prefix.length))
    if (Number.isInteger(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`
}

/** 支払期日の既定値：発行日の翌月末 */
export function defaultDueDate(issueDate: string): string {
  const [y, m] = issueDate.split('-').map(Number)
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10)
}

export type Issuer = { name: string; address: string; tel: string; registrationNo: string; bank: string }

export type InvoiceDraft = {
  issuer: Issuer
  client: string
  invoiceNo: string
  issueDate: string
  dueDate: string
  lines: LineInput[]
  note: string
}

export type DraftIssue = { field: string; message: string }

/** 発行前の入力チェック。問題があればすべて返す */
export function validateDraft(d: InvoiceDraft): DraftIssue[] {
  const issues: DraftIssue[] = []
  if (!d.client.trim()) issues.push({ field: '宛先', message: '宛先（取引先）を入力してください' })
  if (!d.issuer.name.trim()) issues.push({ field: '発行元', message: '発行元の会社名を入力してください' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.issueDate)) issues.push({ field: '発行日', message: '発行日を入力してください' })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.dueDate)) issues.push({ field: '支払期日', message: '支払期日を入力してください' })
  else if (d.dueDate < d.issueDate) issues.push({ field: '支払期日', message: '支払期日が発行日より前になっています' })
  if (d.issuer.registrationNo && !/^T\d{13}$/.test(d.issuer.registrationNo)) {
    issues.push({ field: '登録番号', message: '登録番号は「T」と13桁の数字です（例：T1234567890123）' })
  }
  if (d.lines.length === 0) issues.push({ field: '明細', message: '明細を1行以上入力してください' })
  d.lines.forEach((l, i) => {
    const n = i + 1
    if (!l.name.trim()) issues.push({ field: `明細${n}`, message: `明細${n}行目の品目が空です` })
    if (!(l.qty > 0)) issues.push({ field: `明細${n}`, message: `明細${n}行目の数量は0より大きくしてください` })
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) issues.push({ field: `明細${n}`, message: `明細${n}行目の単価は0以上にしてください` })
  })
  if (issues.length === 0 && calcInvoice(d.lines).total <= 0) issues.push({ field: '明細', message: '合計金額が0円です' })
  return issues
}
