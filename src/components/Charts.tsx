import type { ReactNode } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Group } from '../types'
import { yen, yenShort } from '../lib/format'

type Props = { monthly: Group[]; media: Group[]; clients: Group[]; singleMonth: boolean }

const C = { fee: '#2b6cb0', cost: '#dd8a3e', profit: '#2f855a', bad: '#c53030', cpa: '#805ad5' }

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-3 sm:p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="mt-2 h-64">{children}</div>
    </section>
  )
}

export default function Charts({ monthly, media, clients, singleMonth }: Props) {
  const monthData = monthly.map((g) => ({
    name: `${Number(g.key.slice(5))}月`,
    報酬: g.totals.monthlyFee,
    外注費: g.totals.outsourcingCost,
    粗利: g.totals.grossProfit,
  }))
  const mediaData = media
    .filter((g) => g.totals.adSpend > 0)
    .map((g) => ({ name: g.key, CPA: Math.round(g.totals.cpa ?? 0), CV数: g.totals.conversions }))
  const clientData = [...clients]
    .sort((a, b) => b.totals.grossProfit - a.totals.grossProfit)
    .map((g) => ({ name: g.key, 粗利: g.totals.grossProfit }))
  const period = singleMonth ? '（対象月）' : '（全期間）'

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card title="月別 報酬・外注費・粗利の推移" note="クライアント・媒体フィルターを反映">
        <ResponsiveContainer>
          <ComposedChart data={monthData} margin={{ left: -10, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ec" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={yenShort} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => yen(Number(v))} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="報酬" fill={C.fee} />
            <Bar dataKey="外注費" fill={C.cost} />
            <Line dataKey="粗利" stroke={C.profit} strokeWidth={2} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <Card title={`媒体別 CPA・CV数${period}`} note="広告費のある媒体のみ">
        <ResponsiveContainer>
          <ComposedChart data={mediaData} margin={{ left: -10, right: -10, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ec" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="l" tickFormatter={yenShort} tick={{ fontSize: 11 }} />
            <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, n) => (n === 'CPA' ? yen(Number(v)) : `${v}件`)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar yAxisId="l" dataKey="CPA" fill={C.cpa} />
            <Bar yAxisId="r" dataKey="CV数" fill={C.fee} />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="lg:col-span-2">
        <Card title={`クライアント別 粗利${period}`} note="マイナスは赤で表示">
          <ResponsiveContainer>
            <BarChart data={clientData} layout="vertical" margin={{ left: 20, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e3e7ec" />
              <XAxis type="number" tickFormatter={yenShort} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => yen(Number(v))} />
              <Bar dataKey="粗利">
                {clientData.map((d) => (
                  <Cell key={d.name} fill={d.粗利 < 0 ? C.bad : C.profit} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  )
}
