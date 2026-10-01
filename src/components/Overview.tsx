import { useMemo, useState } from 'react'
import {
  Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import type { Invoice } from '../types'
import {
  aging, arAt, byClient, byMonth, change, dueThisMonth, prevMonthEnd, rankByDelay, rankByOverdueAmount, receivable, summarize,
} from '../lib/aggregate'
import { dateLabel, num, pct, yen, yenShort } from '../lib/format'
import ReminderPanel from './ReminderPanel'
import { Card, Kpi, StatusBadge } from './ui'

const AGING_COLOR = ['#2c3e66', '#c98a1b', '#d9622b', '#c2412d']

export default function Overview({ invoices, asOf }: { invoices: Invoice[]; asOf: string }) {
  const [reminderOf, setReminderOf] = useState<string | null>(null)
  const d = useMemo(() => {
    const s = summarize(invoices, asOf)
    const clients = byClient(invoices, asOf)
    return {
      s,
      prevAr: arAt(invoices, prevMonthEnd(asOf)),
      aging: aging(invoices, asOf),
      months: byMonth(invoices, asOf),
      urgent: rankByOverdueAmount(clients, 5),
      worst: rankByDelay(clients, 5),
      due: dueThisMonth(invoices, asOf),
    }
  }, [invoices, asOf])

  const arChange = change(d.s.ar, d.prevAr)
  const monthData = d.months.map((m) => ({
    name: `${Number(m.month.slice(5))}月`,
    請求額: m.billed,
    入金額: m.collected,
    売掛金残高: m.ar,
  }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="売掛金残高"
          value={yen(d.s.ar)}
          sub={arChange === null ? '前月末比 —' : `前月末比 ${arChange >= 0 ? '▲' : '▼'}${Math.abs(arChange * 100).toFixed(1)}%`}
        />
        <Kpi label="今月の回収予定" value={yen(d.s.dueThisMonthAmount)} sub={`${d.s.dueThisMonthCount}件（遅延中を含む）`} />
        <Kpi
          label="支払遅延の残高"
          value={yen(d.s.overdueAmount)}
          sub={`${d.s.overdueCount}件`}
          tone={d.s.overdueCount > 0 ? 'bad' : 'good'}
        />
        <Kpi label="回収率" value={pct(d.s.collectionRate)} sub="期日が到来した請求分" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="売掛金の年齢別残高" note="期日からの経過日数ごとの未回収額">
          <div className="mt-2 h-60">
            <ResponsiveContainer>
              <ComposedChart data={d.aging.map((a) => ({ name: a.bucket, 残高: a.amount, 件数: a.count }))} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dfcf" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenShort} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v, n) => (n === '残高' ? yen(Number(v)) : `${v}件`)} />
                <Bar isAnimationActive={false} dataKey="残高">
                  {d.aging.map((a, i) => <Cell key={a.bucket} fill={AGING_COLOR[i]} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="月別 請求・入金・売掛金残高" note="請求は請求日、入金は入金日、残高は月末時点">
          <div className="mt-2 h-60">
            <ResponsiveContainer>
              <ComposedChart data={monthData} margin={{ left: -8, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dfcf" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={yenShort} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => yen(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar isAnimationActive={false} dataKey="請求額" fill="#2c3e66" />
                <Bar isAnimationActive={false} dataKey="入金額" fill="#2f7d5b" />
                <Line isAnimationActive={false} dataKey="売掛金残高" stroke="#c2412d" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="回収を急ぐべき取引先" note="並び順：現在遅延中の残高が大きい順">
          {d.urgent.length === 0 ? (
            <p className="mt-3 text-sm text-muted">現在遅延中の取引先はありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.urgent.map((c) => (
                <li key={c.client} className="py-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{c.client}</div>
                      <div className="text-xs text-muted">
                        遅延中 {c.overdueCount}件 ・ 最大{num(c.maxOverdueDays)}日
                        {c.hasPartialOverdue && <span className="ml-1 text-amber">・一部入金のうえ遅延</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-bold text-overdue">{yen(c.overdueAmount)}</span>
                      <button
                        type="button"
                        aria-expanded={reminderOf === c.client}
                        onClick={() => setReminderOf(reminderOf === c.client ? null : c.client)}
                        className="rounded border border-line bg-card px-2 py-1 text-xs"
                      >
                        {reminderOf === c.client ? '閉じる' : '督促文'}
                      </button>
                    </div>
                  </div>
                  {reminderOf === c.client && (
                    <div className="mt-2">
                      <ReminderPanel client={c.client} invoices={invoices} asOf={asOf} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="支払いが遅れがちな取引先" note="並び順：遅延回数が多い順（同数なら平均遅延日数が長い順）">
          {d.worst.length === 0 ? (
            <p className="mt-3 text-sm text-muted">遅延の履歴がある取引先はありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.worst.map((c) => (
                <li key={c.client} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{c.client}</div>
                    <div className="text-xs text-muted">
                      遅延率 {pct(c.lateRate)} ・ 平均 {Math.round(c.avgLateDays ?? 0)}日遅れ
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="font-bold">{c.lateCount}</span>
                    <span className="text-xs text-muted"> / {c.evaluableCount}件が遅延</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2" title="今月の回収予定" note={`${asOf.slice(0, 4)}年${Number(asOf.slice(5, 7))}月が期日で未回収の請求書`}>
          {d.due.length === 0 ? (
            <p className="mt-3 text-sm text-muted">今月が期日の未回収請求書はありません。</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.due.map((i) => (
                <li key={i.invoiceNo} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{i.client}</div>
                    <div className="text-xs text-muted">{i.invoiceNo} ・ 期日 {dateLabel(i.dueDate)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold">{yen(receivable(i))}</div>
                    <StatusBadge invoice={i} asOf={asOf} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
