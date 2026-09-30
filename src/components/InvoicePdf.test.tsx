import { writeFileSync } from 'node:fs'
import { Font, renderToBuffer } from '@react-pdf/renderer'
import { describe, expect, it } from 'vitest'
import { InvoiceDocument, jpDate } from './InvoicePdf'
import type { InvoiceDraft } from '../lib/invoiceCalc'

Font.register({
  family: 'NotoSansJP',
  fonts: [
    { src: 'public/fonts/NotoSansJP-Regular.otf', fontWeight: 400 },
    { src: 'public/fonts/NotoSansJP-Bold.otf', fontWeight: 700 },
  ],
})
Font.registerHyphenationCallback((w) => [w])

const draft = (over: Partial<InvoiceDraft> = {}): InvoiceDraft => ({
  issuer: {
    name: '株式会社サンプル商事', address: '東京都千代田区サンプル1-2-3', tel: '03-0000-0000',
    registrationNo: 'T1234567890123', bank: 'サンプル銀行 本店 普通 1234567\nカ）サンプルショウジ',
  },
  client: '丸山製作所', invoiceNo: 'INV-202609-001', issueDate: '2026-09-30', dueDate: '2026-10-31',
  lines: [
    { name: 'Webサイト保守（9月分）', qty: 1, unitPrice: 50000, taxRate: 10 },
    { name: '社内ランチ用 弁当', qty: 10, unitPrice: 500, taxRate: 8 },
    { name: '立替金（印紙代）', qty: 1, unitPrice: 1000, taxRate: 0 },
  ],
  note: '振込手数料はご負担ください。', ...over,
})

const pages = (buf: Buffer) => (buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length

describe('請求書PDFの生成', () => {
  it('日本語を含む請求書をPDFとして生成できる', async () => {
    const buf = await renderToBuffer(InvoiceDocument({ draft: draft() }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(buf.length).toBeGreaterThan(10_000) // フォントが埋め込まれている
    expect(pages(buf)).toBe(1)
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT, buf)
  }, 60_000)

  it('明細が多いと複数ページになる', async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ name: `品目${i + 1}`, qty: 1, unitPrice: 1000, taxRate: 10 as const }))
    const buf = await renderToBuffer(InvoiceDocument({ draft: draft({ lines: many }) }))
    expect(pages(buf)).toBeGreaterThan(1)
    if (process.env.PDF_OUT) writeFileSync(process.env.PDF_OUT.replace('.pdf', '-long.pdf'), buf)
  }, 60_000)

  it('振込先・備考・登録番号が空でも生成できる', async () => {
    const d = draft({ note: '' })
    d.issuer = { ...d.issuer, bank: '', registrationNo: '', address: '', tel: '' }
    const buf = await renderToBuffer(InvoiceDocument({ draft: d }))
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-')
  }, 60_000)
})

describe('日付の表記', () => {
  it('2026-09-05 → 2026年9月5日', () => expect(jpDate('2026-09-05')).toBe('2026年9月5日'))
})
