// サンプルCSV生成（乱数シード固定なので何度実行しても同じ結果）
// 実行: npm run sample
import { writeFileSync } from 'node:fs'

let seed = 20260930
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const jitter = (v: number, pct: number) => v * (1 + (rand() * 2 - 1) * pct)

const months = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']

type Line = {
  client: string
  media: string
  spend: [number, number] // 開始月, 最終月の広告費
  cpa: [number, number] // 開始月, 最終月のCPA（円）
  inqRatio: number // 問い合わせ数 = CV数 × この倍率
  fee: number
  outsource: [number, number]
  startIndex?: number // 途中月から開始
}

const lines: Line[] = [
  // 好調：CPA改善・CV増
  { client: '青葉美容クリニック', media: 'Google広告', spend: [400000, 560000], cpa: [9000, 5800], inqRatio: 2.2, fee: 120000, outsource: [30000, 32000] },
  { client: '青葉美容クリニック', media: 'Instagram', spend: [150000, 220000], cpa: [8000, 5200], inqRatio: 2.4, fee: 80000, outsource: [25000, 28000] },
  // CPA悪化：直近2ヶ月で急悪化
  { client: 'みらい不動産', media: 'Meta広告', spend: [500000, 520000], cpa: [14000, 27000], inqRatio: 2.0, fee: 100000, outsource: [20000, 22000] },
  { client: 'みらい不動産', media: 'Google広告', spend: [350000, 360000], cpa: [12000, 13500], inqRatio: 1.8, fee: 90000, outsource: [15000, 15000] },
  // 外注費過多：動画編集で粗利が低い／マイナス月あり
  { client: 'アパレルLUNA', media: 'TikTok', spend: [250000, 300000], cpa: [4500, 4800], inqRatio: 3.0, fee: 90000, outsource: [70000, 122000] },
  { client: 'アパレルLUNA', media: 'Instagram', spend: [200000, 210000], cpa: [3800, 4000], inqRatio: 3.0, fee: 70000, outsource: [45000, 62000] },
  { client: 'アパレルLUNA', media: 'X', spend: [60000, 60000], cpa: [5200, 5500], inqRatio: 2.5, fee: 40000, outsource: [28000, 30000] },
  // 安定型
  { client: '大和整骨院グループ', media: 'Google広告', spend: [300000, 310000], cpa: [7000, 7100], inqRatio: 1.6, fee: 90000, outsource: [12000, 12000] },
  { client: '大和整骨院グループ', media: 'Meta広告', spend: [180000, 185000], cpa: [6500, 6800], inqRatio: 1.7, fee: 60000, outsource: [10000, 10000] },
  // SNS運用のみ（広告費0）
  { client: 'カフェ・ソレイユ', media: 'Instagram', spend: [0, 0], cpa: [0, 0], inqRatio: 0, fee: 150000, outsource: [60000, 65000] },
  { client: 'カフェ・ソレイユ', media: 'X', spend: [0, 0], cpa: [0, 0], inqRatio: 0, fee: 50000, outsource: [15000, 15000] },
  // 好調（BtoB）
  { client: 'テックブリッジ株式会社', media: 'Google広告', spend: [600000, 640000], cpa: [26000, 21000], inqRatio: 1.5, fee: 150000, outsource: [30000, 30000] },
  { client: 'テックブリッジ株式会社', media: 'X', spend: [120000, 150000], cpa: [30000, 24000], inqRatio: 1.4, fee: 60000, outsource: [18000, 18000] },
  // 途中（6月）から開始した新規
  { client: '旬菜ダイニング花梨', media: 'Meta広告', spend: [200000, 260000], cpa: [5500, 4200], inqRatio: 2.3, fee: 80000, outsource: [20000, 20000], startIndex: 2 },
  { client: '旬菜ダイニング花梨', media: 'Instagram', spend: [90000, 120000], cpa: [5000, 4600], inqRatio: 2.3, fee: 50000, outsource: [22000, 22000], startIndex: 2 },
  // 低粗利：報酬に対し外注が重い＋CV減少
  { client: 'ホームリフォーム東洋', media: 'Google広告', spend: [420000, 400000], cpa: [18000, 19000], inqRatio: 1.9, fee: 70000, outsource: [38000, 50000] },
  { client: 'ホームリフォーム東洋', media: 'TikTok', spend: [150000, 90000], cpa: [15000, 22000], inqRatio: 2.6, fee: 50000, outsource: [30000, 41000] },
]

const rows: string[] = ['month,client,media,ad_spend,inquiries,conversions,monthly_fee,outsourcing_cost']
for (const l of lines) {
  months.forEach((m, i) => {
    if (l.startIndex !== undefined && i < l.startIndex) return
    const from = l.startIndex ?? 0
    const t = (i - from) / (months.length - 1 - from)
    const lerp = (a: number, b: number) => a + (b - a) * t
    let spend = Math.round(jitter(lerp(...l.spend), 0.04) / 1000) * 1000
    let cpa = lerp(...l.cpa)
    // みらい不動産Meta：最後の2ヶ月で急悪化させる
    if (l.client === 'みらい不動産' && l.media === 'Meta広告') cpa = [14000, 14500, 15000, 15500, 21000, 27000][i]
    let conv = spend === 0 ? 0 : Math.max(1, Math.round(spend / jitter(cpa, 0.06)))
    const inq = spend === 0 ? 0 : Math.round(conv * jitter(l.inqRatio, 0.08))
    const out = Math.round(jitter(lerp(...l.outsource), 0.03) / 1000) * 1000
    rows.push([m, l.client, l.media, spend, inq, conv, l.fee, out].join(','))
  })
}

writeFileSync(new URL('../public/sample.csv', import.meta.url), rows.join('\n') + '\n', 'utf8')
console.log(`public/sample.csv を出力しました（${rows.length - 1}行）`)
