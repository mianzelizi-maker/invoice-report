import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Invoice } from '../types'
import { byClient } from '../lib/aggregate'
import { num, pct, yen, yenShort } from '../lib/format'
import { Card, td, tdR, th, thR } from './ui'

export default function ClientView({ invoices, asOf }: { invoices: Invoice[]; asOf: string }) {
  const clients = useMemo(() => byClient(invoices, asOf).sort((a, b) => b.ar - a.ar), [invoices, asOf])
  const chart = clients
    .filter((c) => c.ar > 0)
    .map((c) => ({ name: c.client, 期日超過: c.overdueAmount, 期日内: c.ar - c.overdueAmount }))

  return (
    <div className="space-y-4">
      <Card title="取引先別 売掛金残高" note="赤は支払期日を過ぎている分">
        <div className="mt-2" style={{ height: Math.max(220, chart.length * 34 + 60) }}>
          <ResponsiveContainer>
            <BarChart data={chart} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6dfcf" />
              <XAxis type="number" tickFormatter={yenShort} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => yen(Number(v))} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar isAnimationActive={false} dataKey="期日内" stackId="a" fill="#2c3e66" />
              <Bar isAnimationActive={false} dataKey="期日超過" stackId="a" fill="#c2412d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card title="取引先ごとの状況" note="遅延回数＝遅れて入金された請求書と、現在遅延中の請求書の合計">
        <div className="-mx-3 mt-2 overflow-x-auto sm:-mx-4">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th className={`${th} sticky left-0 bg-paper`}>取引先</th>
                <th className={thR}>売掛金残高</th>
                <th className={thR}>うち遅延</th>
                <th className={thR}>最大遅延</th>
                <th className={thR}>遅延回数</th>
                <th className={thR}>遅延率</th>
                <th className={thR}>平均遅延日数</th>
                <th className={thR}>請求件数</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.client} className={`border-t border-line ${c.overdueAmount > 0 ? 'bg-overdue-soft' : ''}`}>
                  <td className={`${td} sticky left-0 font-medium ${c.overdueAmount > 0 ? 'bg-overdue-soft' : 'bg-card'}`}>
                    {c.client}
                    {c.hasPartialOverdue && (
                      <span className="ml-2 rounded bg-overdue/15 px-1.5 py-0.5 text-[10px] font-bold text-overdue ring-1 ring-amber">
                        一部入金・遅延
                      </span>
                    )}
                  </td>
                  <td className={`${tdR} font-semibold`}>{yen(c.ar)}</td>
                  <td className={`${tdR} ${c.overdueAmount > 0 ? 'font-bold text-overdue' : 'text-muted'}`}>{yen(c.overdueAmount)}</td>
                  <td className={tdR}>{c.maxOverdueDays > 0 ? `${num(c.maxOverdueDays)}日` : '—'}</td>
                  <td className={tdR}>{c.lateCount}/{c.evaluableCount}</td>
                  <td className={tdR}>{pct(c.lateRate)}</td>
                  <td className={tdR}>{c.avgLateDays === null ? '—' : `${c.avgLateDays.toFixed(1)}日`}</td>
                  <td className={tdR}>{c.invoiceCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
