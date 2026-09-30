export const yen = (n: number | null) =>
  n === null ? '—' : `${n < 0 ? '-' : ''}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`

export const yenShort = (n: number) => {
  const a = Math.abs(n)
  const s = a >= 10000 ? `${(a / 10000).toFixed(a >= 1000000 ? 0 : 1)}万` : `${Math.round(a)}`
  return `${n < 0 ? '-' : ''}${s}`
}

export const num = (n: number) => Math.round(n).toLocaleString('ja-JP')
export const pct = (n: number | null) => (n === null ? '—' : `${(n * 100).toFixed(1)}%`)
export const monthLabel = (m: string) => `${m.slice(0, 4)}年${Number(m.slice(5))}月`

/** 2026-09-30 → 2026/09/30 */
export const dateLabel = (d: string | null) => (d ? d.replaceAll('-', '/') : '—')
