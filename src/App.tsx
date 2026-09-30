import { useState } from 'react'
import type { Invoice } from './types'
import { SAMPLE_AS_OF, loadSample } from './lib/csv'
import { balance, displayStatus, overdueDays } from './lib/status'
import { dateLabel, yen } from './lib/format'

// Step 1 の暫定画面：サンプルを読み込み、判定結果を一覧で確認する。
// 本格的なダッシュボードは Step 3 で作り直す。
const BADGE: Record<string, string> = {
  入金済み: 'bg-paid/15 text-paid',
  一部入金: 'bg-amber/15 text-amber',
  未入金: 'bg-navy/10 text-navy',
  支払遅延: 'bg-overdue/15 text-overdue font-bold',
}

export default function App() {
  const [rows, setRows] = useState<Invoice[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSample = async () => {
    try {
      setRows(await loadSample())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-navy text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <h1 className="text-lg font-bold">請求・入金管理レポート</h1>
          <button onClick={handleSample} className="rounded-md bg-amber px-3 py-2 text-sm font-semibold text-white">
            サンプルデータで試す
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {error && <p className="text-overdue">{error}</p>}
        {!rows ? (
          <p className="text-muted">「サンプルデータで試す」を押してください。</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <p className="p-3 text-xs text-muted">基準日 {dateLabel(SAMPLE_AS_OF)} ／ {rows.length}件</p>
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr>
                  {['取引先', '請求番号', '請求額', '支払期日', '入金額', '残高', '状態', '遅延日数'].map((h) => (
                    <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = displayStatus(r, SAMPLE_AS_OF)
                  return (
                    <tr key={r.invoiceNo + r.client} className="border-t border-line">
                      <td className="px-3 py-2 whitespace-nowrap">{r.client}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.invoiceNo}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{yen(r.amount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{dateLabel(r.dueDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{yen(r.paidAmount)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{yen(balance(r))}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`rounded px-2 py-0.5 text-xs ${BADGE[st]}`}>{st}</span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{overdueDays(r, SAMPLE_AS_OF) || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
