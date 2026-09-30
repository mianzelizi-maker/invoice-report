import type { Totals } from '../types'
import { change } from '../lib/aggregate'
import { num, pct, yen } from '../lib/format'

type Props = { cur: Totals; prev: Totals | null }

type Def = {
  label: string
  value: string
  cur: number | null
  prev: number | null
  lowerIsBetter?: boolean
}

export default function KpiCards({ cur, prev }: Props) {
  const defs: Def[] = [
    { label: '広告費', value: yen(cur.adSpend), cur: cur.adSpend, prev: prev?.adSpend ?? null },
    { label: '問い合わせ数', value: `${num(cur.inquiries)}件`, cur: cur.inquiries, prev: prev?.inquiries ?? null },
    { label: 'CV数', value: `${num(cur.conversions)}件`, cur: cur.conversions, prev: prev?.conversions ?? null },
    { label: 'CPA', value: yen(cur.cpa), cur: cur.cpa, prev: prev?.cpa ?? null, lowerIsBetter: true },
    { label: '月額報酬', value: yen(cur.monthlyFee), cur: cur.monthlyFee, prev: prev?.monthlyFee ?? null },
    { label: '外注費', value: yen(cur.outsourcingCost), cur: cur.outsourcingCost, prev: prev?.outsourcingCost ?? null, lowerIsBetter: true },
    { label: '粗利', value: yen(cur.grossProfit), cur: cur.grossProfit, prev: prev?.grossProfit ?? null },
    { label: '粗利率', value: pct(cur.grossMargin), cur: cur.grossMargin, prev: prev?.grossMargin ?? null },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {defs.map((d) => {
        const c = change(d.cur, d.prev)
        const good = c === null || c === 0 ? null : d.lowerIsBetter ? c < 0 : c > 0
        const negative = d.cur !== null && d.cur < 0
        return (
          <div key={d.label} className="rounded-xl border border-line bg-white p-3 sm:p-4">
            <div className="text-xs text-muted">{d.label}</div>
            <div className={`mt-1 text-lg font-bold sm:text-2xl ${negative ? 'text-bad' : ''}`}>{d.value}</div>
            <div className={`mt-1 text-xs ${good === null ? 'text-muted' : good ? 'text-good' : 'text-bad'}`}>
              {c === null ? '前月比 —' : `前月比 ${c > 0 ? '▲' : '▼'}${Math.abs(c * 100).toFixed(1)}%`}
            </div>
          </div>
        )
      })}
    </div>
  )
}
