import { useRef, useState } from 'react'
import type { Invoice } from '../types'
import { COLUMNS, decodeBytes, loadErrorDemo, parseCsv, type ParseResult } from '../lib/csv'
import { num } from '../lib/format'
import { Card, td, th } from './ui'

type Props = {
  current: { label: string; count: number } | null
  onImport: (invoices: Invoice[], label: string) => void
}

const MAX_SHOWN = 100

export default function ImportView({ current, onImport }: Props) {
  const [result, setResult] = useState<{ label: string; data: ParseResult } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const handleResult = (label: string, data: ParseResult) => {
    // 誤りが1つもなければそのまま取り込む。誤りがあれば内容を見せて、取り込み方を選んでもらう
    if (data.issues.length === 0 && data.invoices.length > 0) {
      setResult(null)
      onImport(data.invoices, label)
    } else {
      setResult({ label, data })
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      handleResult(file.name, parseCsv(decodeBytes(await file.arrayBuffer())))
    } catch {
      setError('ファイルを読み込めませんでした。CSVファイルか確認してください。')
    }
  }

  const handleDemo = async () => {
    setError(null)
    try {
      handleResult('誤りを含むデモ用CSV', await loadErrorDemo())
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    }
  }

  const data = result?.data

  return (
    <div className="space-y-4">
      <Card title="CSVを取り込む" note="請求書1件が1行のCSV。Excelで保存した Shift_JIS のCSVも読めます。">
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files[0]) }}
          className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-8 text-center ${
            dragging ? 'border-amber bg-amber/10' : 'border-line bg-paper'
          }`}
        >
          <span className="font-semibold text-navy">ここにCSVをドロップ、またはクリックして選択</span>
          <span className="text-xs text-muted">.csv ファイル</span>
          <input
            ref={input}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = '' }}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <a className="text-navy underline" href={`${import.meta.env.BASE_URL}sample.csv`} download="sample.csv">
            サンプルCSVをダウンロード
          </a>
          <button className="text-navy underline" onClick={handleDemo}>誤りを含むCSVで、エラー表示を試す</button>
        </div>
        {current && (
          <p className="mt-3 text-xs text-muted">現在のデータ：{current.label}（{num(current.count)}件）</p>
        )}
        {error && <p className="mt-3 text-sm text-overdue">{error}</p>}
      </Card>

      {data && (
        <Card>
          <h3 className="text-sm font-bold text-navy">読み込み結果：{result.label}</h3>
          <p className="mt-1 text-sm">
            {data.fatal ? (
              <span className="font-bold text-overdue">取り込めませんでした。下の内容を直してもう一度読み込んでください。</span>
            ) : (
              <>
                全{num(data.totalRows)}行のうち、<span className="font-bold text-paid">{num(data.invoices.length)}行は問題なし</span>、
                <span className="font-bold text-overdue">{num(data.invalidRows)}行に誤り</span>があります。
              </>
            )}
          </p>

          <ul className="mt-3 divide-y divide-line rounded-lg border border-line md:hidden">
            {data.issues.slice(0, MAX_SHOWN).map((i, n) => (
              <li key={n} className="px-3 py-2 text-sm">
                <div className="text-xs text-muted">{i.row > 0 ? `${i.row}行目` : 'ファイル全体'}　列：{i.column}</div>
                <div className="text-overdue">{i.message}</div>
                {i.value && <div className="text-xs text-muted">入力値：{i.value}</div>}
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto rounded-lg border border-line md:block">
            <table className="w-full text-sm">
              <thead className="bg-paper text-xs text-muted">
                <tr><th className={th}>行</th><th className={th}>列</th><th className={th}>内容</th><th className={th}>入力値</th></tr>
              </thead>
              <tbody>
                {data.issues.slice(0, MAX_SHOWN).map((i, n) => (
                  <tr key={n} className="border-t border-line">
                    <td className={`${td} font-semibold`}>{i.row > 0 ? `${i.row}行目` : '全体'}</td>
                    <td className={td}>{i.column}</td>
                    <td className="px-3 py-2 text-overdue">{i.message}</td>
                    <td className={`${td} text-muted`}>{i.value || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.issues.length > MAX_SHOWN && (
            <p className="mt-2 text-xs text-muted">ほか {num(data.issues.length - MAX_SHOWN)} 件の誤りがあります（先頭 {MAX_SHOWN} 件を表示）</p>
          )}

          {!data.fatal && data.invoices.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={() => { onImport(data.invoices, `${result.label}（誤り${num(data.invalidRows)}行を除く）`); setResult(null) }}
                className="rounded-md bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                誤りのある行を除いて {num(data.invoices.length)} 件を取り込む
              </button>
              <button onClick={() => setResult(null)} className="text-sm text-muted underline">やめる</button>
            </div>
          )}
        </Card>
      )}

      <Card title="CSVの形式" note="1行目は見出し行。日本語の見出しでも読み込めます。">
        <ul className="mt-2 divide-y divide-line md:hidden">
          {COLUMNS.map((c) => (
            <li key={c.key} className="py-2 text-sm">
              <div>
                <span className="font-semibold">{c.label}</span>
                <span className="ml-1 text-xs text-muted">{c.aliases[0]}</span>
                <span className="ml-2 text-xs text-muted">例：{c.example}</span>
              </div>
              <div className="text-xs text-muted">{c.note}</div>
            </li>
          ))}
        </ul>
        <div className="-mx-4 mt-2 hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead className="bg-paper text-xs text-muted">
              <tr><th className={th}>列（見出し）</th><th className={th}>例</th><th className={th}>ルール</th></tr>
            </thead>
            <tbody>
              {COLUMNS.map((c) => (
                <tr key={c.key} className="border-t border-line">
                  <td className={td}>
                    <span className="font-semibold">{c.label}</span>
                    <span className="ml-1 text-xs text-muted">{c.aliases[0]}</span>
                  </td>
                  <td className={td}>{c.example}</td>
                  <td className="px-3 py-2 text-muted">{c.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
