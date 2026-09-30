import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildReportData, parseAiText, reportToText, ruleBasedReport } from './report'
import { parseCsv, SAMPLE_AS_OF } from './csv'
import { sanitizeFacts } from '../../api/_core'
import type { Invoice } from '../types'

const invoices = parseCsv(readFileSync('public/sample.csv', 'utf8')).invoices
const data = buildReportData(invoices, SAMPLE_AS_OF)
const rule = ruleBasedReport(data)
const text = (r = rule) => r.sections.flatMap((s) => [s.title, ...s.lines]).join('\n')

describe('レポート用の集計値', () => {
  it('サンプルの主要な数値が集計と一致する', () => {
    expect(data.ar).toBe(12213000)
    expect(data.overdueCount).toBe(12)
    expect(data.urgent[0]).toMatchObject({ client: '東和建設', maxOverdueDays: 133 })
    expect(data.urgent.map((u) => u.client)).toContain('サクラ食品')
    expect(data.dueNextMonth.count).toBeGreaterThan(0)
  })
  it('AIに送る集計値は、サーバー側の検証をそのまま通る（形がずれていない）', () => {
    expect(sanitizeFacts(JSON.parse(JSON.stringify(data)))).not.toBeNull()
  })
  it('AIに送る内容に、請求番号以外の個別明細（請求額・入金額の一覧など）は含まれない', () => {
    const json = JSON.stringify(data)
    expect(json.length).toBeLessThan(3000)
    expect(json).not.toContain('paidAmount')
  })
})

describe('ルールベースの文章', () => {
  it('必要な見出しがそろい、数字と取引先名が入る', () => {
    expect(rule.source).toBe('rule')
    expect(rule.sections.map((s) => s.title)).toEqual([
      '全体の状況', '今月の回収予定', '回収を急ぐ取引先', '支払いが遅れがちな取引先', '次のアクション',
    ])
    const t = text()
    expect(t).toContain('¥12,213,000')
    expect(t).toContain('東和建設')
    expect(t).toContain('最大133日遅れ')
    expect(t).toContain('一部入金のうえ遅延') // サクラ食品など
    expect(t).toContain('61日を超えて滞留')
  })
  it('前月末との比較・今月と来月の回収予定を文章にする', () => {
    const t = text()
    expect(t).toMatch(/前月末（¥[\d,]+）より[\d.]+%増えて/)
    expect(t).toContain('9月が期日で未回収の請求は')
    expect(t).toContain('来月（10月）が期日')
  })
  it('遅延がないデータでは、遅延なしの文章と「対応不要」になる', () => {
    const clean: Invoice[] = [
      { client: 'A社', invoiceNo: 'INV-1', issueDate: '2026-08-31', amount: 100000, dueDate: '2026-09-30', paidDate: '2026-09-25', paidAmount: 100000 },
      { client: 'A社', invoiceNo: 'INV-2', issueDate: '2026-09-15', amount: 50000, dueDate: '2026-10-15', paidDate: null, paidAmount: 0 },
    ]
    const r = ruleBasedReport(buildReportData(clean, '2026-09-30'))
    const t = text(r)
    expect(t).toContain('支払期日を過ぎている請求はありません')
    expect(t).toContain('特に対応が必要な項目はありません')
    expect(r.sections.map((s) => s.title)).not.toContain('回収を急ぐ取引先')
  })
  it('データが空でも落ちない', () => {
    const r = ruleBasedReport(buildReportData([], '2026-09-30'))
    expect(text(r)).toContain('売掛金残高は¥0')
  })
})

describe('AIの出力の取り込み', () => {
  it('「## 見出し」と箇条書きをセクションに分ける', () => {
    const s = parseAiText('## 今月の注目ポイント\n- 残高は¥1,000です\n- 遅延なし\n\n## 次のアクション\n・確認する\n')
    expect(s).toEqual([
      { title: '今月の注目ポイント', lines: ['残高は¥1,000です', '遅延なし'] },
      { title: '次のアクション', lines: ['確認する'] },
    ])
  })
  it('見出しがなくても文章を捨てない。空なら空配列', () => {
    expect(parseAiText('残高は増えています')).toEqual([{ title: '今月の注目ポイント', lines: ['残高は増えています'] }])
    expect(parseAiText('  \n ')).toEqual([])
  })
})

describe('コピー用テキスト', () => {
  it('見出し・箇条書き付きの文章になる', () => {
    const t = reportToText(rule, SAMPLE_AS_OF)
    expect(t).toContain('2026年9月 売掛金レポート（基準日 2026/09/30）')
    expect(t).toContain('■全体の状況\n・売掛金残高は')
  })
})
