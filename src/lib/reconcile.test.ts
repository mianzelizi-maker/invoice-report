import { describe, expect, it } from 'vitest'
import type { Invoice } from '../types'
import { paymentHistory } from './status'
import { applyMatches, findClient, matchDeposits, normalizePayer, parseDeposits } from './reconcile'

const inv = (o: Partial<Invoice>): Invoice => ({
  client: '東和建設', clientKana: 'トウワケンセツ', invoiceNo: 'INV-1', issueDate: '2026-07-01',
  amount: 100000, dueDate: '2026-08-31', paidDate: null, paidAmount: 0, ...o,
})
const dep = (id: number, payer: string, amount: number, date = '2026-10-01') => ({ id, date, payer, amount })

describe('normalizePayer / findClient', () => {
  it('半角カナ・法人格の違いを吸収する', () => {
    expect(normalizePayer('ｶ)ﾄｳﾜｹﾝｾﾂ')).toBe('トウワケンセツ')
    expect(normalizePayer('(株)東和建設')).toBe('東和建設')
  })
  it('振込名義（半角カナ・途中で切れた名義）から取引先を特定する', () => {
    const list = [inv({}), inv({ invoiceNo: 'X', client: '東洋商事', clientKana: 'トウヨウショウジ' })]
    expect(findClient('ﾄｳﾜｹﾝｾﾂ(ｶ', list)).toBe('東和建設')
    expect(findClient('ﾄｳﾜｹﾝ', list)).toBe('東和建設')
    expect(findClient('ﾄｳﾖｳ', list)).toBe('東洋商事')
  })
  it('一致しない・短すぎる名義は null', () => {
    expect(findClient('ﾔﾏﾀﾞ', [inv({})])).toBeNull()
    expect(findClient('ﾄ', [inv({})])).toBeNull()
  })
})

describe('matchDeposits', () => {
  it('残高とぴったり一致する請求書に消し込む（古い請求書でなくても）', () => {
    const list = [inv({ invoiceNo: 'A', amount: 100000 }), inv({ invoiceNo: 'B', amount: 250000, dueDate: '2026-09-30' })]
    const [m] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 250000)], list)
    expect(m.kind).toBe('exact')
    expect(m.allocations).toEqual([{ invoiceNo: 'B', amount: 250000 }])
  })
  it('残高より少なければ一部入金として最も古い請求書に充当する', () => {
    const [m] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 30000)], [inv({})])
    expect(m.kind).toBe('partial')
    expect(m.allocations).toEqual([{ invoiceNo: 'INV-1', amount: 30000 }])
  })
  it('複数の請求書にまたがる入金は期日の古い順に充当する', () => {
    const list = [inv({ invoiceNo: 'A' }), inv({ invoiceNo: 'B', dueDate: '2026-09-30' })]
    const [m] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 150000)], list)
    expect(m.kind).toBe('multi')
    expect(m.allocations).toEqual([{ invoiceNo: 'A', amount: 100000 }, { invoiceNo: 'B', amount: 50000 }])
  })
  it('残高の合計を超える入金・取引先不明は自動では消し込まない', () => {
    const [over, none] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 999999), dep(2, 'ﾔﾏﾀﾞﾀﾛｳ', 100000)], [inv({})])
    expect(over).toMatchObject({ kind: 'over', allocations: [] })
    expect(none).toMatchObject({ kind: 'unmatched', client: null, allocations: [] })
  })
  it('同じ請求書に2回は充当しない（先に消し込んだ分は残高から引く）', () => {
    const [a, b] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 100000, '2026-10-01'), dep(2, 'ﾄｳﾜｹﾝｾﾂ', 100000, '2026-10-02')], [inv({})])
    expect(a.kind).toBe('exact')
    expect(b.kind).toBe('over')
  })
  it('入金済み・過入金の請求書は対象外', () => {
    const [m] = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 100000)], [inv({ paidAmount: 100000 })])
    expect(m.kind).toBe('over')
  })
})

describe('applyMatches', () => {
  it('入金額を足し、入金日を新しいほうにする。対象外の請求書は変えない', () => {
    const list = [inv({ invoiceNo: 'A', paidAmount: 30000, paidDate: '2026-09-01' }), inv({ invoiceNo: 'B' })]
    const matches = matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 70000, '2026-10-05')], list)
    const out = applyMatches(list, matches)
    expect(out[0]).toMatchObject({ paidAmount: 100000, paidDate: '2026-10-05' })
    expect(out[1]).toBe(list[1])
  })
})

describe('applyMatches の入金履歴', () => {
  it('既存の入金を1回目として残し、消込を2回目として履歴に足す', () => {
    const list = [inv({ paidAmount: 30000, paidDate: '2026-09-01' })]
    const out = applyMatches(list, matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 70000, '2026-10-05')], list))
    expect(out[0].payments).toEqual([{ date: '2026-09-01', amount: 30000 }, { date: '2026-10-05', amount: 70000 }])
    expect(paymentHistory(out[0])).toHaveLength(2)
  })
  it('同じ請求書への複数回の消込も、日付順の履歴になる', () => {
    const list = [inv({})]
    const ms = [...matchDeposits([dep(1, 'ﾄｳﾜｹﾝｾﾂ', 20000, '2026-10-09')], list), ...matchDeposits([dep(2, 'ﾄｳﾜｹﾝｾﾂ', 10000, '2026-10-02')], list)]
    const out = applyMatches(list, ms)
    expect(out[0].payments!.map((p) => p.date)).toEqual(['2026-10-02', '2026-10-09'])
    expect(out[0]).toMatchObject({ paidAmount: 30000, paidDate: '2026-10-09' })
  })
})

describe('parseDeposits', () => {
  it('見出しと行を読み、誤りのある行は理由つきで除く', () => {
    const csv = '入金日,振込名義,金額\n2026/10/1,ﾄｳﾜｹﾝｾﾂ,"1,245,200"\n2026-13-01,ﾔﾏﾀﾞ,100\n2026-10-02,,100\n2026-10-03,ﾎｸﾄ,abc\n'
    const r = parseDeposits(csv)
    expect(r.deposits).toEqual([{ id: 1, date: '2026-10-01', payer: 'ﾄｳﾜｹﾝｾﾂ'.normalize('NFKC'), amount: 1245200 }])
    expect(r.issues.map((i) => i.row)).toEqual([3, 4, 5])
  })
  it('必要な列がなければ理由を返す', () => {
    expect(parseDeposits('a,b\n1,2').issues[0].message).toContain('入金日')
  })
})
