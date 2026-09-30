import { describe, expect, it } from 'vitest'
import {
  agingBucket, balance, daysBetween, displayStatus, isOverdue, lateDays, overdueDays, paymentStatus,
} from './status'
import type { Invoice } from '../types'

const inv = (o: Partial<Invoice> = {}): Invoice => ({
  client: 'A', invoiceNo: 'INV-202609-001', issueDate: '2026-08-31', amount: 110000,
  dueDate: '2026-09-30', paidDate: null, paidAmount: 0, ...o,
})

describe('daysBetween', () => {
  it('月またぎ・年またぎを正しく数える', () => {
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetween('2026-10-02', '2026-09-30')).toBe(-2)
  })
})

describe('paymentStatus', () => {
  it('入金額で3状態を判定する', () => {
    expect(paymentStatus(inv())).toBe('未入金')
    expect(paymentStatus(inv({ paidAmount: 50000 }))).toBe('一部入金')
    expect(paymentStatus(inv({ paidAmount: 110000, paidDate: '2026-09-30' }))).toBe('入金済み')
  })
  it('過入金も入金済みとして扱い、残高はマイナスになる', () => {
    const o = inv({ paidAmount: 120000 })
    expect(paymentStatus(o)).toBe('入金済み')
    expect(balance(o)).toBe(-10000)
  })
})

describe('支払遅延', () => {
  it('期日の前日・当日は遅延ではなく、翌日から遅延', () => {
    expect(isOverdue(inv(), '2026-09-29')).toBe(false)
    expect(isOverdue(inv(), '2026-09-30')).toBe(false)
    expect(isOverdue(inv(), '2026-10-01')).toBe(true)
    expect(overdueDays(inv(), '2026-10-01')).toBe(1)
  })
  it('一部入金でも残高があり期日超過なら支払遅延を優先表示', () => {
    expect(displayStatus(inv({ paidAmount: 50000 }), '2026-10-15')).toBe('支払遅延')
    expect(displayStatus(inv({ paidAmount: 50000 }), '2026-09-15')).toBe('一部入金')
  })
  it('入金済みは遅れて入金していても現在の遅延にはならない', () => {
    const o = inv({ paidAmount: 110000, paidDate: '2026-10-05' })
    expect(displayStatus(o, '2026-10-31')).toBe('入金済み')
    expect(overdueDays(o, '2026-10-31')).toBe(0)
  })
})

describe('lateDays（発生した遅延日数）', () => {
  it('未回収は基準日まで、入金済みは入金日までの遅れ', () => {
    expect(lateDays(inv(), '2026-10-10')).toBe(10)
    expect(lateDays(inv({ paidAmount: 110000, paidDate: '2026-10-05' }), '2026-12-31')).toBe(5)
  })
  it('期日前に入金していれば 0', () => {
    expect(lateDays(inv({ paidAmount: 110000, paidDate: '2026-09-25' }), '2026-12-31')).toBe(0)
  })
})

describe('agingBucket', () => {
  it('境界値で区分する', () => {
    expect(agingBucket(0)).toBe('期日内')
    expect(agingBucket(1)).toBe('1〜30日')
    expect(agingBucket(30)).toBe('1〜30日')
    expect(agingBucket(31)).toBe('31〜60日')
    expect(agingBucket(60)).toBe('31〜60日')
    expect(agingBucket(61)).toBe('61日超')
  })
})
