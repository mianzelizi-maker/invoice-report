import { Fragment, useMemo, useState } from 'react'
import type { Invoice } from '../types'
import { receivable, byClient } from '../lib/aggregate'
import { dateLabel, num, yen } from '../lib/format'
import { balance, overdueDays, paymentHistory } from '../lib/status'
import { Card, StatusBadge, statusKey, td, tdR, th, thR } from './ui'

const ALL = 'all'
const STATUS_OPTIONS = ['支払遅延', '未入金', '一部入金', '入金済み']
type Sort = 'due-desc' | 'due-asc' | 'overdue' | 'balance'

const selectCls = 'w-full rounded-md border border-line bg-white px-2 py-2 text-sm'

export default function InvoiceList({ invoices, asOf }: { invoices: Invoice[]; asOf: string }) {
  const [status, setStatus] = useState(ALL)
  const [client, setClient] = useState(ALL)
  const [sort, setSort] = useState<Sort>('overdue')
  const [open, setOpen] = useState<Set<string>>(new Set()) // 入金履歴を開いている請求書

  const clients = useMemo(() => byClient(invoices, asOf).map((c) => c.client).sort((a, b) => a.localeCompare(b, 'ja')), [invoices, asOf])

  const rows = useMemo(() => {
    const list = invoices.filter(
      (i) => (status === ALL || statusKey(i, asOf) === status) && (client === ALL || i.client === client),
    )
    const cmp: Record<Sort, (a: Invoice, b: Invoice) => number> = {
      'due-desc': (a, b) => b.dueDate.localeCompare(a.dueDate),
      'due-asc': (a, b) => a.dueDate.localeCompare(b.dueDate),
      overdue: (a, b) => overdueDays(b, asOf) - overdueDays(a, asOf) || b.dueDate.localeCompare(a.dueDate),
      balance: (a, b) => receivable(b) - receivable(a),
    }
    return [...list].sort(cmp[sort])
  }, [invoices, asOf, status, client, sort])

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) next.add(key)
      return next
    })

  const totalAr = rows.reduce((s, i) => s + receivable(i), 0)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted">
          状態
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={ALL}>すべて</option>
            {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          取引先
          <select className={selectCls} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value={ALL}>すべて</option>
            {clients.map((c) => <option key={c}>{c}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          並び順
          <select className={selectCls} value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="overdue">遅延日数の多い順</option>
            <option value="due-desc">支払期日が新しい順</option>
            <option value="due-asc">支払期日が古い順</option>
            <option value="balance">残高の大きい順</option>
          </select>
        </label>
      </div>

      <Card>
        <p className="text-xs text-muted">
          {num(rows.length)}件 ／ 未回収残高 <span className="font-semibold text-ink">{yen(totalAr)}</span>
          　※「支払遅延」には一部入金のうえ遅延している請求書も含みます
        </p>
        <div className="-mx-3 mt-2 overflow-x-auto sm:-mx-4">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr>
                <th className={`${th} sticky left-0 bg-paper`}>取引先</th>
                <th className={th}>状態</th>
                <th className={thR}>遅延日数</th>
                <th className={thR}>残高</th>
                <th className={th}>支払期日</th>
                <th className={th}>請求番号</th>
                <th className={th}>請求日</th>
                <th className={thR}>請求額</th>
                <th className={thR}>入金額</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => {
                const days = overdueDays(i, asOf)
                const key = i.invoiceNo + i.client
                const history = paymentHistory(i)
                return (
                  <Fragment key={key}>
                  <tr className={`border-t border-line ${days > 0 ? 'bg-overdue-soft' : ''}`}>
                    <td className={`${td} sticky left-0 font-medium ${days > 0 ? 'bg-overdue-soft' : 'bg-card'}`}>{i.client}</td>
                    <td className={td}><StatusBadge invoice={i} asOf={asOf} /></td>
                    <td className={`${tdR} ${days > 0 ? 'font-bold text-overdue' : 'text-muted'}`}>{days > 0 ? `${num(days)}日` : '—'}</td>
                    <td className={`${tdR} ${balance(i) > 0 ? 'font-semibold' : 'text-muted'}`}>{yen(Math.max(0, balance(i)))}</td>
                    <td className={td}>{dateLabel(i.dueDate)}</td>
                    <td className={td}>{i.invoiceNo}</td>
                    <td className={td}>{dateLabel(i.issueDate)}</td>
                    <td className={tdR}>{yen(i.amount)}</td>
                    <td className={tdR}>
                      {yen(i.paidAmount)}
                      {history.length >= 2 && (
                        <button
                          type="button"
                          aria-expanded={open.has(key)}
                          onClick={() => toggle(key)}
                          className="ml-2 rounded border border-line bg-card px-1.5 py-0.5 text-[10px] text-navy"
                        >
                          {history.length}回{open.has(key) ? '▲' : '▼'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open.has(key) && (
                    <tr className="bg-paper text-xs">
                      <td colSpan={9} className="px-3 py-2">
                        <span className="font-semibold text-navy">入金履歴：</span>
                        {history.map((p, n) => (
                          <span key={n} className="mr-4 whitespace-nowrap">{dateLabel(p.date)} {yen(p.amount)}</span>
                        ))}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted">該当する請求書はありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
