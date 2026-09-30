import { describe, expect, it } from 'vitest'
import { calcInvoice, defaultDueDate, lineAmount, nextInvoiceNo, validateDraft, type InvoiceDraft } from './invoiceCalc'

describe('金額の計算', () => {
  it('10%：小計・消費税・合計', () => {
    const t = calcInvoice([
      { name: 'Web制作', qty: 1, unitPrice: 300000, taxRate: 10 },
      { name: '保守', qty: 3, unitPrice: 20000, taxRate: 10 },
    ])
    expect(t.subtotal).toBe(360000)
    expect(t.tax).toBe(36000)
    expect(t.total).toBe(396000)
    expect(t.groups).toEqual([{ rate: 10, subtotal: 360000, tax: 36000 }])
  })
  it('消費税は税率ごとに合計に対して1回だけ切り捨てる（明細ごとではない）', () => {
    const lines = [
      { name: 'A', qty: 1, unitPrice: 105, taxRate: 10 as const },
      { name: 'B', qty: 1, unitPrice: 105, taxRate: 10 as const },
    ]
    // 明細ごと: floor(10.5)+floor(10.5)=20 / 合計に対して: floor(21.0)=21
    expect(calcInvoice(lines).tax).toBe(21)
  })
  it('軽減税率8%・10%・非課税が混在すると、税率ごとに分けて計算する', () => {
    const t = calcInvoice([
      { name: '弁当', qty: 10, unitPrice: 500, taxRate: 8 },
      { name: '配送', qty: 1, unitPrice: 3333, taxRate: 10 },
      { name: '立替金', qty: 1, unitPrice: 1000, taxRate: 0 },
    ])
    expect(t.groups).toEqual([
      { rate: 10, subtotal: 3333, tax: 333 }, // 333.3 → 切り捨て
      { rate: 8, subtotal: 5000, tax: 400 },
      { rate: 0, subtotal: 1000, tax: 0 },
    ])
    expect(t.subtotal).toBe(9333)
    expect(t.tax).toBe(733)
    expect(t.total).toBe(10066)
  })
  it('使っていない税率の行は出さない', () => {
    expect(calcInvoice([{ name: 'A', qty: 1, unitPrice: 100, taxRate: 10 }]).groups.map((g) => g.rate)).toEqual([10])
  })
  it('数量が小数でも円未満は四捨五入', () => {
    expect(lineAmount({ qty: 1.5, unitPrice: 333 })).toBe(500) // 499.5
    expect(lineAmount({ qty: 0.1, unitPrice: 3 })).toBe(0)
  })
  it('明細が空なら0円', () => {
    expect(calcInvoice([])).toMatchObject({ subtotal: 0, tax: 0, total: 0, groups: [] })
  })
})

describe('請求番号の自動採番', () => {
  it('同じ年月の最大連番の次を返す', () => {
    expect(nextInvoiceNo(['INV-202609-001', 'INV-202609-010', 'INV-202609-003'], '2026-09-30')).toBe('INV-202609-011')
  })
  it('その月の番号がなければ 001。他の月の番号は数えない', () => {
    expect(nextInvoiceNo(['INV-202608-099'], '2026-09-01')).toBe('INV-202609-001')
    expect(nextInvoiceNo([], '2026-10-05')).toBe('INV-202610-001')
  })
  it('形式の違う番号は無視する', () => {
    expect(nextInvoiceNo(['INV-202609-abc', 'X-1', 'INV-202609-002'], '2026-09-10')).toBe('INV-202609-003')
  })
  it('1000件を超えても桁が増えるだけで衝突しない', () => {
    expect(nextInvoiceNo(['INV-202609-999'], '2026-09-10')).toBe('INV-202609-1000')
  })
})

describe('支払期日の既定値', () => {
  it('発行日の翌月末（うるう年・年またぎも）', () => {
    expect(defaultDueDate('2026-09-15')).toBe('2026-10-31')
    expect(defaultDueDate('2026-12-31')).toBe('2027-01-31')
    expect(defaultDueDate('2028-01-31')).toBe('2028-02-29')
  })
})

describe('発行前のチェック', () => {
  const ok = (): InvoiceDraft => ({
    issuer: { name: '株式会社サンプル', address: '', tel: '', registrationNo: 'T1234567890123', bank: '' },
    client: '丸山製作所', invoiceNo: 'INV-202609-001', issueDate: '2026-09-30', dueDate: '2026-10-31',
    lines: [{ name: 'Web制作', qty: 1, unitPrice: 100000, taxRate: 10 }], note: '',
  })
  it('問題がなければ空', () => expect(validateDraft(ok())).toEqual([]))
  it('宛先・発行元・明細の不足を指摘する', () => {
    const d = ok()
    d.client = ' '
    d.issuer.name = ''
    d.lines = []
    expect(validateDraft(d).map((i) => i.field)).toEqual(['宛先', '発行元', '明細'])
  })
  it('日付の前後・登録番号の形式・明細の数値', () => {
    const d = ok()
    d.dueDate = '2026-09-01'
    d.issuer.registrationNo = '12345'
    d.lines = [{ name: '', qty: 0, unitPrice: -1, taxRate: 10 }]
    const msgs = validateDraft(d).map((i) => i.message).join('\n')
    expect(msgs).toContain('支払期日が発行日より前')
    expect(msgs).toContain('登録番号')
    expect(msgs).toContain('品目が空')
    expect(msgs).toContain('数量は0より大きく')
    expect(msgs).toContain('単価は0以上')
  })
  it('登録番号は空でもよい（免税事業者）', () => {
    const d = ok()
    d.issuer.registrationNo = ''
    expect(validateDraft(d)).toEqual([])
  })
  it('合計が0円は発行させない', () => {
    const d = ok()
    d.lines = [{ name: '無償', qty: 1, unitPrice: 0, taxRate: 10 }]
    expect(validateDraft(d).map((i) => i.message)).toContain('合計金額が0円です')
  })
})
