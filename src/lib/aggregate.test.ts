import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  aging, arAt, byClient, byMonth, change, dueThisMonth, prevMonthEnd, rankByDelay, rankByOverdueAmount, rankByReceivable, summarize,
} from './aggregate'
import { parseCsv, SAMPLE_AS_OF } from './csv'
import { statusLabel } from './status'
import type { Invoice } from '../types'

const inv = (o: Partial<Invoice> = {}): Invoice => ({
  client: 'A', invoiceNo: 'INV-1', issueDate: '2026-08-31', amount: 100000,
  dueDate: '2026-09-30', paidDate: null, paidAmount: 0, ...o,
})
const ASOF = '2026-10-10'

describe('summarize', () => {
  const list = [
    inv({ invoiceNo: '1', paidAmount: 100000, paidDate: '2026-09-28' }), // 入金済み
    inv({ invoiceNo: '2', dueDate: '2026-10-05' }), // 遅延中（今月期日）
    inv({ invoiceNo: '3', dueDate: '2026-10-25', paidAmount: 30000, paidDate: '2026-10-01' }), // 今月期日・一部入金
    inv({ invoiceNo: '4', dueDate: '2026-11-30' }), // 来月期日
  ]
  const s = summarize(list, ASOF)
  it('売掛金・遅延・今月の回収予定を集計する', () => {
    expect(s.billed).toBe(400000)
    expect(s.collected).toBe(130000)
    expect(s.ar).toBe(270000)
    expect(s.overdueAmount).toBe(100000)
    expect(s.overdueCount).toBe(1)
    expect(s.dueThisMonthAmount).toBe(170000) // 遅延中の10万＋残り7万
    expect(s.dueThisMonthCount).toBe(2)
  })
  it('回収率は期日到来分だけで計算する', () => {
    expect(s.collectionRate).toBeCloseTo(100000 / 200000)
    expect(summarize([inv({ dueDate: '2026-12-01' })], ASOF).collectionRate).toBeNull()
  })
  it('過入金は売掛金に含めない', () => {
    expect(summarize([inv({ paidAmount: 120000, paidDate: '2026-09-30' })], ASOF).ar).toBe(0)
  })
})

describe('byClient / rankByDelay', () => {
  const list = [
    inv({ client: 'X', invoiceNo: '1', paidAmount: 100000, paidDate: '2026-10-05' }), // 5日遅れて入金
    inv({ client: 'X', invoiceNo: '2', dueDate: '2026-09-20' }), // 20日遅延中
    inv({ client: 'Y', invoiceNo: '3', paidAmount: 100000, paidDate: '2026-09-29' }), // 期日前
    inv({ client: 'Y', invoiceNo: '4', dueDate: '2026-10-20', paidAmount: 40000, paidDate: '2026-10-01' }),
    inv({ client: 'Z', invoiceNo: '5', dueDate: '2026-09-25', paidAmount: 40000, paidDate: '2026-09-25' }),
  ]
  const clients = byClient(list, ASOF)
  const get = (c: string) => clients.find((x) => x.client === c)!
  it('遅延件数・遅延率・平均遅延日数', () => {
    expect(get('X').lateCount).toBe(2)
    expect(get('X').lateRate).toBe(1)
    expect(get('X').avgLateDays).toBeCloseTo(12.5) // (5 + 20) / 2
    expect(get('Y').lateCount).toBe(0)
    expect(get('Y').avgLateDays).toBeNull()
  })
  it('一部入金のうえ遅延している取引先を判別する', () => {
    expect(get('Z').hasPartialOverdue).toBe(true)
    expect(get('Y').hasPartialOverdue).toBe(false)
    expect(get('Z').maxOverdueDays).toBe(15)
  })
  it('遅延ランキングは遅延のない取引先を含めない', () => {
    expect(rankByDelay(clients).map((c) => c.client)).toEqual(['X', 'Z'])
  })
  it('回収を急ぐ取引先は現在の遅延残高が大きい順で、現在遅延のない取引先を含めない', () => {
    // X: 遅延中10万、Z: 遅延中6万、Y: 現在の遅延なし
    expect(rankByOverdueAmount(clients).map((c) => c.client)).toEqual(['X', 'Z'])
  })
  it('遅延回数が同数なら平均遅延日数が長い順', () => {
    const tie = byClient(
      [
        inv({ client: 'P', invoiceNo: '1', paidAmount: 100000, paidDate: '2026-10-02' }), // 2日遅れ
        inv({ client: 'Q', invoiceNo: '2', paidAmount: 100000, paidDate: '2026-10-08' }), // 8日遅れ
      ],
      ASOF,
    )
    expect(rankByDelay(tie).map((c) => c.client)).toEqual(['Q', 'P'])
  })
  it('売掛金ランキングは残高の大きい順', () => {
    expect(rankByReceivable(clients).map((c) => c.client)).toEqual(['X', 'Y', 'Z'])
  })
})

describe('aging', () => {
  it('経過日数の区分ごとに残高を集計する', () => {
    const rows = aging(
      [
        inv({ dueDate: '2026-10-20' }), // 期日内
        inv({ dueDate: '2026-10-09' }), // 1日
        inv({ dueDate: '2026-09-11' }), // 29日
        inv({ dueDate: '2026-09-10' }), // 30日
        inv({ dueDate: '2026-08-01' }), // 70日
        inv({ dueDate: '2026-08-01', paidAmount: 100000, paidDate: '2026-08-01' }), // 入金済みは対象外
      ],
      ASOF,
    )
    expect(rows.map((r) => [r.bucket, r.count])).toEqual([['期日内', 1], ['1〜30日', 3], ['31〜60日', 0], ['61日超', 1]])
  })
})

describe('arAt / byMonth', () => {
  const list = [
    inv({ invoiceNo: '1', issueDate: '2026-08-15', dueDate: '2026-09-15', paidAmount: 100000, paidDate: '2026-09-20' }),
    inv({ invoiceNo: '2', issueDate: '2026-09-10', dueDate: '2026-10-10' }),
  ]
  it('指定日時点の売掛金残高', () => {
    expect(arAt(list, '2026-08-31')).toBe(100000)
    expect(arAt(list, '2026-09-19')).toBe(200000)
    expect(arAt(list, '2026-09-30')).toBe(100000)
  })
  it('月別の請求・入金・月末残高', () => {
    const rows = byMonth(list, '2026-09-30')
    expect(rows.map((r) => r.month)).toEqual(['2026-08', '2026-09'])
    expect(rows[1]).toMatchObject({ billed: 100000, collected: 100000, ar: 100000 })
  })
  it('分割入金は入金日ごとに、残高と月別の入金額へ反映される', () => {
    const split = [
      inv({
        issueDate: '2026-07-15', dueDate: '2026-08-15', amount: 100000, paidAmount: 100000, paidDate: '2026-09-05',
        payments: [{ date: '2026-08-20', amount: 30000 }, { date: '2026-09-05', amount: 70000 }],
      }),
    ]
    expect(arAt(split, '2026-08-19')).toBe(100000)
    expect(arAt(split, '2026-08-31')).toBe(70000)
    expect(arAt(split, '2026-09-05')).toBe(0)
    const rows = byMonth(split, '2026-09-30')
    expect(rows.map((r) => [r.month, r.collected])).toEqual([['2026-07', 0], ['2026-08', 30000], ['2026-09', 70000]])
  })
  it('請求額を超える入金は月別の入金額に数えない', () => {
    const over = [inv({ amount: 100000, paidAmount: 130000, payments: [{ date: '2026-09-01', amount: 100000 }, { date: '2026-09-02', amount: 30000 }] })]
    expect(byMonth(over, '2026-09-30').find((r) => r.month === '2026-09')!.collected).toBe(100000)
  })
  it('前月末を返す', () => {
    expect(prevMonthEnd('2026-09-30')).toBe('2026-08-31')
    expect(prevMonthEnd('2026-01-15')).toBe('2025-12-31')
  })
  it('変化率', () => {
    expect(change(150, 100)).toBeCloseTo(0.5)
    expect(change(10, 0)).toBeNull()
  })
})

describe('statusLabel', () => {
  it('一部入金のうえ遅延している場合は「一部入金・遅延」と表示する', () => {
    expect(statusLabel(inv({ paidAmount: 30000, paidDate: '2026-09-30' }), '2026-10-10')).toBe('一部入金・遅延')
    expect(statusLabel(inv(), '2026-10-10')).toBe('支払遅延')
    expect(statusLabel(inv({ paidAmount: 30000, paidDate: '2026-09-30' }), '2026-09-30')).toBe('一部入金')
    expect(statusLabel(inv(), '2026-09-30')).toBe('未入金')
  })
})

describe('サンプルデータ全体の整合', () => {
  const invoices = parseCsv(readFileSync('public/sample.csv', 'utf8')).invoices
  const s = summarize(invoices, SAMPLE_AS_OF)
  it('取引先別・年齢別・月別の合計が全体と一致する', () => {
    const clients = byClient(invoices, SAMPLE_AS_OF)
    expect(clients.reduce((a, c) => a + c.ar, 0)).toBe(s.ar)
    expect(aging(invoices, SAMPLE_AS_OF).reduce((a, r) => a + r.amount, 0)).toBe(s.ar)
    expect(arAt(invoices, SAMPLE_AS_OF)).toBe(s.ar)
    const months = byMonth(invoices, SAMPLE_AS_OF)
    expect(months.at(-1)!.ar).toBe(s.ar)
  })
  it('意図した傾向が出ている', () => {
    const clients = byClient(invoices, SAMPLE_AS_OF)
    expect(rankByReceivable(clients)[0].client).toBe('東和建設')
    expect(clients.find((c) => c.client === '東和建設')!.maxOverdueDays).toBe(133)
    expect(clients.find((c) => c.client === '丸山製作所')!.lateCount).toBe(0)
    expect(rankByDelay(clients)[0].lateCount).toBeGreaterThanOrEqual(3)
    expect(dueThisMonth(invoices, SAMPLE_AS_OF).length).toBe(s.dueThisMonthCount)
    // ヤマト商会：普段は期日どおりだが2件が現在遅延中。常に数日遅れる北斗デザインとは別の傾向
    const yamato = clients.find((c) => c.client === 'ヤマト商会')!
    const hokuto = clients.find((c) => c.client === '北斗デザイン')!
    expect(yamato.overdueCount).toBe(2)
    expect(yamato.maxOverdueDays).toBe(42)
    expect(yamato.lateCount).toBeLessThan(hokuto.lateCount)
    expect(yamato.avgLateDays).not.toBeCloseTo(hokuto.avgLateDays!, 0)
    // 回収を急ぐ順の先頭は東和建設
    expect(rankByOverdueAmount(clients)[0].client).toBe('東和建設')
  })
})
