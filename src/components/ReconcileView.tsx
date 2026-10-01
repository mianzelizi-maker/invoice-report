import { useState } from 'react'
import type { Invoice } from '../types'
import { decodeBytes } from '../lib/csv'
import { dateLabel, num, yen } from '../lib/format'
import { applyMatches, matchDeposits, parseDeposits, type DepositIssue, type Match, type MatchKind } from '../lib/reconcile'
import { Card, td, tdR, th, thR } from './ui'

const KIND: Record<MatchKind, { label: string; hint: string; cls: string }> = {
  exact: { label: '一致', hint: '残高とぴったり一致', cls: 'bg-paid/15 text-paid' },
  partial: { label: '一部入金', hint: '残高より少ない金額', cls: 'bg-amber/15 text-amber' },
  multi: { label: '複数に充当', hint: '期日の古い請求書から順に充当', cls: 'bg-amber/15 text-amber' },
  over: { label: '要確認', hint: '未回収の残高を超える、または残高がない', cls: 'bg-overdue/15 text-overdue font-bold' },
  unmatched: { label: '取引先不明', hint: '振込名義に合う取引先がない', cls: 'bg-overdue/15 text-overdue font-bold' },
}

const applicable = (m: Match) => m.allocations.length > 0

const target = (m: Match) =>
  m.allocations.length === 0 ? '—' : m.allocations.map((a) => `${a.invoiceNo}（${yen(a.amount)}）`).join('、')

type Props = {
  invoices: Invoice[]
  onApply: (invoices: Invoice[]) => void
}

export default function ReconcileView({ invoices, onApply }: Props) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  const [label, setLabel] = useState('')
  const [issues, setIssues] = useState<DepositIssue[]>([])
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = (name: string, text: string) => {
    const parsed = parseDeposits(text)
    const m = matchDeposits(parsed.deposits, invoices)
    setMatches(m)
    setLabel(name)
    setIssues(parsed.issues)
    setChecked(new Set(m.filter(applicable).map((x) => x.deposit.id)))
    setDone(null)
    setError(parsed.deposits.length === 0 ? '読み込める入金明細がありませんでした。' : null)
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      load(file.name, decodeBytes(await file.arrayBuffer()))
    } catch {
      setError('ファイルを読み込めませんでした。CSVファイルか確認してください。')
    }
  }

  const handleSample = async () => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}deposits-sample.csv`)
      if (!res.ok) throw new Error()
      load('サンプルの入金明細', await res.text())
    } catch {
      setError('サンプルを読み込めませんでした。')
    }
  }

  const selected = matches?.filter((m) => checked.has(m.deposit.id)) ?? []
  const selectedTotal = selected.reduce((s, m) => s + m.deposit.amount, 0)

  const apply = () => {
    onApply(applyMatches(invoices, selected))
    setDone(`${num(selected.length)}件（${yen(selectedTotal)}）を消し込みました。概要・請求書一覧に反映されています。`)
    setMatches(null)
  }

  const toggle = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      <Card title="入金消込" note="銀行の入金明細（入金日・振込名義・金額のCSV）を、未回収の請求書と突き合わせます。確認してから反映します。">
        <label className="mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-line bg-paper px-4 py-6 text-center">
          <span className="font-semibold text-navy">クリックして入金明細CSVを選択</span>
          <span className="text-xs text-muted">振込名義は半角カナ・（カ や カ) の付いた形でも照合できます</span>
          <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }} />
        </label>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button className="text-navy underline" onClick={handleSample}>サンプルの入金明細で試す</button>
          <a className="text-navy underline" href={`${import.meta.env.BASE_URL}deposits-sample.csv`} download="deposits-sample.csv">サンプルCSVをダウンロード</a>
        </div>
        {done && <p className="mt-3 text-sm font-bold text-paid">{done}</p>}
        {error && <p className="mt-3 text-sm text-overdue">{error}</p>}
        {issues.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-xs text-overdue">
            {issues.map((i, n) => <li key={n}>{i.row > 0 ? `${i.row}行目：` : ''}{i.message}</li>)}
          </ul>
        )}
      </Card>

      {matches && matches.length > 0 && (
        <Card title={`消込の候補：${label}`} note="チェックした入金だけを反映します。要確認・取引先不明は自動では反映しません。">
          <ul className="mt-3 divide-y divide-line md:hidden">
            {matches.map((m) => (
              <li key={m.deposit.id} className="flex gap-3 py-2 text-sm">
                <input type="checkbox" className="mt-1" aria-label={`${m.deposit.payer}の入金を反映`} disabled={!applicable(m)} checked={checked.has(m.deposit.id)} onChange={() => toggle(m.deposit.id)} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-semibold">{m.client ?? m.deposit.payer}</span>
                    <span className="shrink-0 font-bold">{yen(m.deposit.amount)}</span>
                  </div>
                  <div className="text-xs text-muted">{dateLabel(m.deposit.date)} ・ 名義 {m.deposit.payer}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded px-2 py-0.5 ${KIND[m.kind].cls}`}>{KIND[m.kind].label}</span>
                    <span className="text-muted">{m.allocations.length > 0 ? target(m) : KIND[m.kind].hint}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="-mx-4 mt-2 hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  <th className={th}>反映</th><th className={th}>入金日</th><th className={th}>振込名義</th><th className={th}>取引先</th>
                  <th className={thR}>金額</th><th className={th}>判定</th><th className={th}>充当先の請求書</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((m) => (
                  <tr key={m.deposit.id} className="border-t border-line">
                    <td className={td}>
                      <input type="checkbox" aria-label={`${m.deposit.payer}の入金を反映`} disabled={!applicable(m)} checked={checked.has(m.deposit.id)} onChange={() => toggle(m.deposit.id)} />
                    </td>
                    <td className={td}>{dateLabel(m.deposit.date)}</td>
                    <td className={td}>{m.deposit.payer}</td>
                    <td className={`${td} font-medium`}>{m.client ?? '—'}</td>
                    <td className={`${tdR} font-semibold`}>{yen(m.deposit.amount)}</td>
                    <td className={td}><span className={`rounded px-2 py-0.5 text-xs ${KIND[m.kind].cls}`} title={KIND[m.kind].hint}>{KIND[m.kind].label}</span></td>
                    <td className="px-3 py-2 text-xs text-muted">{target(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              disabled={selected.length === 0}
              onClick={apply}
              className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40"
            >
              選んだ {num(selected.length)} 件（{yen(selectedTotal)}）を消し込む
            </button>
            <button onClick={() => setMatches(null)} className="text-sm text-muted underline">やめる</button>
          </div>
        </Card>
      )}
    </div>
  )
}
