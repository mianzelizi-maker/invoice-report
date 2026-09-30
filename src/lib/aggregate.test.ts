import { describe, expect, it } from 'vitest'
import { groupBy, prevMonth, sumRows } from './aggregate'
import type { Row } from '../types'

const row = (o: Partial<Row>): Row => ({
  month: '2026-09', client: 'A', media: 'Google広告',
  adSpend: 100000, inquiries: 20, conversions: 10, monthlyFee: 80000, outsourcingCost: 20000, ...o,
})

describe('sumRows', () => {
  it('CPA・粗利・粗利率を計算する', () => {
    const t = sumRows([row({}), row({ adSpend: 200000, conversions: 20 })])
    expect(t.cpa).toBe(10000)
    expect(t.grossProfit).toBe(120000)
    expect(t.grossMargin).toBeCloseTo(0.75)
  })
  it('CV0や広告費0ならCPAはnull、報酬0なら粗利率はnull', () => {
    expect(sumRows([row({ conversions: 0 })]).cpa).toBeNull()
    expect(sumRows([row({ adSpend: 0, conversions: 0 })]).cpa).toBeNull()
    expect(sumRows([row({ monthlyFee: 0 })]).grossMargin).toBeNull()
  })
  it('外注費が報酬を上回ると粗利はマイナス', () => {
    expect(sumRows([row({ outsourcingCost: 100000 })]).grossProfit).toBe(-20000)
  })
})

describe('groupBy / prevMonth', () => {
  it('キーごとに合算する', () => {
    const g = groupBy([row({}), row({ client: 'B' }), row({})], (r) => r.client)
    expect(g.find((x) => x.key === 'A')?.totals.adSpend).toBe(200000)
  })
  it('年またぎの前月を返す', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
    expect(prevMonth('2026-09')).toBe('2026-08')
  })
})
