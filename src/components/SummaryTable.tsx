import { useState } from 'react'
import type { Group } from '../types'
import { monthLabel, num, pct, yen } from '../lib/format'

type Tab = 'client' | 'media' | 'month'
type Props = { client: Group[]; media: Group[]; month: Group[] }

const TABS: { id: Tab; label: string }[] = [
  { id: 'client', label: 'クライアント別' },
  { id: 'media', label: '媒体別' },
  { id: 'month', label: '月別' },
]

export default function SummaryTable({ client, media, month }: Props) {
  const [tab, setTab] = useState<Tab>('client')
  const groups = tab === 'client' ? client : tab === 'media' ? media : month
  const sorted = tab === 'month' ? groups : [...groups].sort((a, b) => b.totals.grossProfit - a.totals.grossProfit)
  const th = 'px-3 py-2 text-right font-medium whitespace-nowrap'
  const td = 'px-3 py-2 text-right whitespace-nowrap'

  return (
    <section className="rounded-xl border border-line bg-white">
      <div className="flex gap-1 border-b border-line p-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-brand font-semibold text-white' : 'text-muted hover:bg-bg'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-bg text-xs text-muted">
            <tr>
              <th className="sticky left-0 bg-bg px-3 py-2 text-left font-medium whitespace-nowrap">
                {tab === 'month' ? '月' : tab === 'client' ? 'クライアント' : '媒体'}
              </th>
              {['広告費', '問合せ', 'CV', 'CPA', '月額報酬', '外注費', '粗利', '粗利率'].map((h) => (
                <th key={h} className={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ key, totals: t }) => (
              <tr key={key} className="border-t border-line">
                <td className="sticky left-0 bg-white px-3 py-2 font-medium whitespace-nowrap">
                  {tab === 'month' ? monthLabel(key) : key}
                </td>
                <td className={td}>{yen(t.adSpend)}</td>
                <td className={td}>{num(t.inquiries)}</td>
                <td className={td}>{num(t.conversions)}</td>
                <td className={td}>{yen(t.cpa)}</td>
                <td className={td}>{yen(t.monthlyFee)}</td>
                <td className={td}>{yen(t.outsourcingCost)}</td>
                <td className={`${td} ${t.grossProfit < 0 ? 'font-bold text-bad' : ''}`}>{yen(t.grossProfit)}</td>
                <td className={td}>{pct(t.grossMargin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
