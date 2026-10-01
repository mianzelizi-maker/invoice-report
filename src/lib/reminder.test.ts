import { describe, expect, it } from 'vitest'
import type { Invoice } from '../types'
import { buildReminder, reminderStage } from './reminder'

const inv = (o: Partial<Invoice>): Invoice => ({
  client: '株式会社A', invoiceNo: 'INV-1', issueDate: '2026-07-01', amount: 100000,
  dueDate: '2026-08-31', paidDate: null, paidAmount: 0, ...o,
})

describe('reminderStage', () => {
  it('遅延日数の境目で文面の強さが変わる', () => {
    expect(reminderStage(1)).toBe('初回')
    expect(reminderStage(30)).toBe('初回')
    expect(reminderStage(31)).toBe('再度')
    expect(reminderStage(60)).toBe('再度')
    expect(reminderStage(61)).toBe('最終')
  })
})

describe('buildReminder', () => {
  const asOf = '2026-09-15'

  it('遅延中の請求書がなければ null（期日当日・入金済み・他社は対象外）', () => {
    const list = [
      inv({ dueDate: asOf }),
      inv({ invoiceNo: 'INV-2', dueDate: '2026-08-01', paidAmount: 100000, paidDate: '2026-08-05' }),
      inv({ invoiceNo: 'INV-3', client: '株式会社B', dueDate: '2026-08-01' }),
    ]
    expect(buildReminder('株式会社A', list, asOf)).toBeNull()
  })

  it('遅延中の請求書を期日順に載せ、合計を出す', () => {
    const list = [
      inv({ invoiceNo: 'INV-2', dueDate: '2026-09-05', amount: 50000 }),
      inv({ invoiceNo: 'INV-1', dueDate: '2026-09-01' }),
      inv({ invoiceNo: 'INV-9', dueDate: '2026-10-31' }),
    ]
    const r = buildReminder('株式会社A', list, asOf)!
    expect(r.invoices.map((i) => i.invoiceNo)).toEqual(['INV-1', 'INV-2'])
    expect(r.total).toBe(150000)
    expect(r.stage).toBe('初回')
    expect(r.body).toContain('株式会社A 御中')
    expect(r.body).toContain('未入金額の合計：¥150,000')
    expect(r.body).not.toContain('INV-9')
  })

  it('一部入金は残高だけを請求し、入金済み額も記載する', () => {
    const r = buildReminder('株式会社A', [inv({ dueDate: '2026-09-01', paidAmount: 30000 })], asOf)!
    expect(r.total).toBe(70000)
    expect(r.body).toContain('未入金額 ¥70,000')
    expect(r.body).toContain('うち ¥30,000 は入金済み')
    expect(r.body).not.toContain('合計')
  })

  it('最も遅れている請求書で段階が決まる', () => {
    const list = [inv({ dueDate: '2026-09-10' }), inv({ invoiceNo: 'INV-2', dueDate: '2026-06-01' })]
    const r = buildReminder('株式会社A', list, asOf)!
    expect(r.stage).toBe('最終')
    expect(r.subject).toContain('最終')
  })
})
