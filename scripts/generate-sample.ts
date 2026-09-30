// サンプルCSV生成（乱数シード固定なので何度実行しても同じ結果）
// 実行: npm run sample
// 基準日 2026-09-30 の時点の請求・入金状況を再現する。
import { writeFileSync } from 'node:fs'

const AS_OF = '2026-09-30'
const MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

let seed = 20260930
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const between = (a: number, b: number) => Math.round(a + rand() * (b - a))

const ms = (s: string) => Date.parse(`${s}T00:00:00Z`)
const addDays = (s: string, n: number) => new Date(ms(s) + n * 86_400_000).toISOString().slice(0, 10)
const lastDay = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5), 0)).getUTCDate()

/** 入金の振る舞い。lateDays は期日からの遅れ（マイナスは前倒し） */
type Pay = { kind: 'paid'; lateDays: number } | { kind: 'partial'; ratio: number; lateDays: number } | { kind: 'unpaid' }

type Client = {
  name: string
  start: number // 請求開始月のindex
  issueDay: number // 請求日（末日は 31 を指定して月末に丸める）
  terms: number // 支払サイト（日）
  base: [number, number] // 税抜の請求額レンジ
  pay: (monthIndex: number) => Pay
}

const paid = (lateDays: number): Pay => ({ kind: 'paid', lateDays })

const clients: Client[] = [
  // 優良：毎回期日より少し前に入金
  { name: '丸山製作所', start: 0, issueDay: 31, terms: 30, base: [380000, 520000], pay: () => paid(between(-3, 0)) },
  // 常に数日遅れる
  { name: '北斗デザイン', start: 0, issueDay: 25, terms: 30, base: [120000, 180000], pay: () => paid(between(3, 9)) },
  // 高額で長期滞留：4月分から一度も入金がない
  { name: '東和建設', start: 0, issueDay: 20, terms: 30, base: [900000, 1300000], pay: () => ({ kind: 'unpaid' }) },
  // 一部入金の常習：期日に半額〜7割だけ払い、残りは入金されない
  { name: 'サクラ食品', start: 0, issueDay: 28, terms: 30, base: [250000, 340000], pay: (i) => (i % 2 === 0 ? { kind: 'partial', ratio: 0.6, lateDays: between(0, 4) } : paid(between(0, 3))) },
  // 期日ちょうどに入金
  { name: 'アルファ物流', start: 0, issueDay: 15, terms: 30, base: [200000, 260000], pay: () => paid(0) },
  // 普通に支払うが、今月（9月）期日の請求が集中
  { name: 'ミドリ薬局', start: 0, issueDay: 31, terms: 30, base: [160000, 220000], pay: () => paid(between(-1, 2)) },
  // 7月から新規、基本は期日内
  { name: 'ネクスト教育', start: 3, issueDay: 10, terms: 45, base: [300000, 380000], pay: () => paid(between(-2, 1)) },
  // ときどき大きく遅れる：直近2件は現在も遅延中（1〜30日）
  { name: 'ヤマト商会', start: 0, issueDay: 20, terms: 30, base: [180000, 240000], pay: (i) => (i >= 4 ? { kind: 'unpaid' } : i === 1 ? paid(between(18, 28)) : paid(between(0, 5))) },
  // 1件が31〜60日の滞留
  { name: '光洋印刷', start: 0, issueDay: 25, terms: 30, base: [90000, 130000], pay: (i) => (i === 3 ? { kind: 'unpaid' } : i === 2 ? paid(between(10, 20)) : paid(between(0, 6))) },
  // 7月分が期日に一部だけ入金され、残りが滞留
  { name: 'セイコー電気', start: 0, issueDay: 31, terms: 30, base: [420000, 520000], pay: (i) => (i === 3 ? { kind: 'partial', ratio: 0.5, lateDays: 0 } : paid(between(-2, 1))) },
]

type Row = {
  client: string; no: string; issue: string; amount: number; due: string; paidDate: string; paidAmount: number
}
const rows: Row[] = []
const seqByMonth = new Map<string, number>()

MONTHS.forEach((ym, mi) => {
  for (const c of clients) {
    if (mi < c.start) continue
    const day = Math.min(c.issueDay, lastDay(ym))
    const issue = `${ym}-${String(day).padStart(2, '0')}`
    if (issue > AS_OF) continue
    const net = Math.round(between(c.base[0], c.base[1]) / 1000) * 1000
    const amount = Math.floor(net * 1.1) // 税込（端数切り捨て）
    const due = addDays(issue, c.terms)
    const seq = (seqByMonth.get(ym) ?? 0) + 1
    seqByMonth.set(ym, seq)
    const no = `INV-${ym.replace('-', '')}-${String(seq).padStart(3, '0')}`

    const p = c.pay(mi)
    let paidDate = ''
    let paidAmount = 0
    if (p.kind !== 'unpaid') {
      const date = addDays(due, p.lateDays)
      // 基準日より先の入金はまだ発生していない
      if (date <= AS_OF) {
        paidDate = date
        paidAmount = p.kind === 'paid' ? amount : Math.round((amount * p.ratio) / 1000) * 1000
      }
    }
    rows.push({ client: c.name, no, issue, amount, due, paidDate, paidAmount })
  }
})

const header = 'client,invoice_no,issue_date,amount,due_date,paid_date,paid_amount'
const lines = rows.map((r) => [r.client, r.no, r.issue, r.amount, r.due, r.paidDate, r.paidAmount].join(','))
writeFileSync(new URL('../public/sample.csv', import.meta.url), [header, ...lines].join('\n') + '\n', 'utf8')
console.log(`public/sample.csv を出力しました（${rows.length}件、基準日 ${AS_OF}）`)
