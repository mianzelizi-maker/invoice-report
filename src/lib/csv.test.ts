import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { decodeBytes, normalizeDate, parseCsv, parseYen } from './csv'

const H = 'client,invoice_no,issue_date,amount,due_date,paid_date,paid_amount'
const csv = (...lines: string[]) => [H, ...lines].join('\n')

describe('正常なCSV', () => {
  it('サンプルCSVは誤りなく全件読める', () => {
    const r = parseCsv(readFileSync('public/sample.csv', 'utf8'))
    expect(r.issues).toEqual([])
    expect(r.invoices).toHaveLength(57)
    expect(r.invalidRows).toBe(0)
  })
  it('日本語ヘッダー・スラッシュ日付・カンマ付き金額・全角数字を受け付ける', () => {
    const r = parseCsv(
      '取引先,請求番号,請求日,請求額,支払期日,入金日,入金額\nA社,INV-1,2026/9/5,"1,100,000",２０２６/１０/５,2026/10/03,"¥1,100,000"',
    )
    expect(r.issues).toEqual([])
    expect(r.invoices[0]).toMatchObject({ issueDate: '2026-09-05', dueDate: '2026-10-05', amount: 1100000, paidDate: '2026-10-03', paidAmount: 1100000 })
  })
  it('未入金の行は入金日・入金額が空でよい', () => {
    const r = parseCsv(csv('A社,INV-1,2026-09-01,1000,2026-09-30,,'))
    expect(r.issues).toEqual([])
    expect(r.invoices[0]).toMatchObject({ paidDate: null, paidAmount: 0 })
  })
  it('空行があっても行番号がずれない', () => {
    const r = parseCsv(`${H}\n\nA社,INV-1,2026-09-01,abc,2026-09-30,,\n`)
    expect(r.issues[0]).toMatchObject({ row: 3, column: '請求額' })
  })
})

describe('ファイル全体の誤り', () => {
  it('必要な列が足りないと、列名を示して取り込めない', () => {
    const r = parseCsv('client,invoice_no,issue_date,amount\nA社,INV-1,2026-09-01,1000')
    expect(r.fatal).toBe(true)
    const cols = r.issues.map((i) => i.column)
    expect(cols).toEqual(expect.arrayContaining(['支払期日', '入金日', '入金額']))
    expect(r.invoices).toHaveLength(0)
  })
  it('空ファイル・見出しだけのファイル', () => {
    expect(parseCsv('').fatal).toBe(true)
    expect(parseCsv(H).fatal).toBe(true)
  })
})

describe('行ごとの誤り（何行目のどの列か）', () => {
  const one = (line: string) => parseCsv(csv(line))
  it('数値でない請求額', () => {
    const r = one('A社,INV-1,2026-09-01,abc,2026-09-30,,')
    expect(r.issues).toEqual([{ row: 2, column: '請求額', message: '請求額が数値ではありません', value: 'abc' }])
    expect(r.invoices).toHaveLength(0)
    expect(r.invalidRows).toBe(1)
  })
  it('実在しない日付', () => {
    expect(one('A社,INV-1,2026-02-30,1000,2026-09-30,,').issues[0]).toMatchObject({ column: '請求日' })
    expect(one('A社,INV-1,2026-09-01,1000,2026-13-01,,').issues[0]).toMatchObject({ column: '支払期日' })
  })
  it('請求額が0以下・支払期日が請求日より前', () => {
    expect(one('A社,INV-1,2026-09-01,0,2026-09-30,,').issues[0].message).toContain('1円以上')
    expect(one('A社,INV-1,2026-09-10,1000,2026-09-01,,').issues[0]).toMatchObject({ column: '支払期日' })
  })
  it('過入金', () => {
    expect(one('A社,INV-1,2026-09-01,1000,2026-09-30,2026-09-20,2000').issues[0]).toMatchObject({ column: '入金額' })
  })
  it('入金額と入金日の片方だけ', () => {
    expect(one('A社,INV-1,2026-09-01,1000,2026-09-30,,500').issues[0]).toMatchObject({ column: '入金日' })
    expect(one('A社,INV-1,2026-09-01,1000,2026-09-30,2026-09-20,').issues[0]).toMatchObject({ column: '入金額' })
  })
  it('取引先・請求番号が空', () => {
    expect(one(',INV-1,2026-09-01,1000,2026-09-30,,').issues[0]).toMatchObject({ column: '取引先' })
    expect(one('A社,,2026-09-01,1000,2026-09-30,,').issues[0]).toMatchObject({ column: '請求番号' })
  })
  it('請求番号の重複は後の行を誤りとし、最初の行は取り込む', () => {
    const r = parseCsv(csv('A社,INV-1,2026-09-01,1000,2026-09-30,,', 'B社,INV-1,2026-09-01,2000,2026-09-30,,'))
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]).toMatchObject({ row: 3, column: '請求番号' })
    expect(r.issues[0].message).toContain('2行目')
    expect(r.invoices.map((i) => i.client)).toEqual(['A社'])
  })
  it('1行に複数の誤りがあれば全て報告し、他の正常行は取り込む', () => {
    const r = parseCsv(csv('A社,INV-1,x,abc,2026-09-30,,', 'B社,INV-2,2026-09-01,2000,2026-09-30,,'))
    expect(r.issues.map((i) => i.column)).toEqual(['請求日', '請求額'])
    expect(r.invalidRows).toBe(1)
    expect(r.invoices).toHaveLength(1)
  })
})

describe('デモ用の誤りCSV', () => {
  const r = parseCsv(readFileSync('public/sample-error.csv', 'utf8'))
  it('意図した行・列が検出される', () => {
    const at = (row: number) => r.issues.filter((i) => i.row === row).map((i) => i.column)
    expect(at(3)).toEqual(['請求額'])
    expect(at(4)).toEqual(['請求日'])
    expect(at(5)).toEqual(['支払期日'])
    expect(at(6)).toEqual(['入金額'])
    expect(at(7)).toEqual(['入金日'])
    expect(at(8)).toEqual(['請求番号'])
    expect(at(9)).toEqual(['取引先'])
    expect(r.invoices).toHaveLength(3) // 2行目・10行目・11行目
    expect(r.totalRows).toBe(10)
  })
})

describe('文字コード・部品', () => {
  it('Shift_JIS のバイト列も読める', () => {
    const sjis = new Uint8Array([0x8e, 0xe6, 0x88, 0xf8, 0x90, 0xe6]) // 取引先
    expect(decodeBytes(sjis)).toBe('取引先')
    expect(decodeBytes(new TextEncoder().encode('﻿取引先'))).toBe('取引先')
  })
  it('日付・金額の解釈', () => {
    expect(normalizeDate('2026/9/5')).toBe('2026-09-05')
    expect(normalizeDate('2026-02-29')).toBeNull()
    expect(normalizeDate('20260905')).toBeNull()
    expect(parseYen('¥1,000')).toBe(1000)
    expect(parseYen('12.5')).toBeNull()
    expect(parseYen('')).toBeNull()
  })
})
