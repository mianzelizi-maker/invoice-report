import { useEffect, useMemo, useState } from 'react'
import type { Invoice } from '../types'
import {
  calcInvoice, defaultDueDate, nextInvoiceNo, validateDraft, type InvoiceDraft, type Issuer, type LineInput, type TaxRate,
} from '../lib/invoiceCalc'
import { buildInvoicePdf, downloadBlob, pdfFileName } from '../lib/pdfExport'
import { candidatesFromInvoices, findExact, mergeCandidates } from '../lib/clientSearch'
import { addIssued, loadHistory, saveHistory } from '../lib/issueHistory'
import ClientCombobox from './ClientCombobox'
import { yen } from '../lib/format'
import { Card } from './ui'

type Props = {
  invoices: Invoice[] | null
  defaultDate: string
  onIssued: (invoice: Invoice) => void
  onLoadSample: () => void
  onOpenImport: () => void
  loadingSample: boolean
}

const STORAGE_KEY = 'invoice-report:issuer'
const DEFAULT_ISSUER: Issuer = {
  name: '株式会社サンプル商事',
  address: '東京都千代田区サンプル1-2-3',
  tel: '03-0000-0000',
  registrationNo: 'T1234567890123', // ダミー（実在しない番号）
  bank: 'サンプル銀行 本店 普通 1234567\nカ）サンプルショウジ',
}
const SAMPLE_LINES: LineInput[] = [
  { name: 'Webサイト保守（9月分）', qty: 1, unitPrice: 50000, taxRate: 10 },
  { name: '広告運用代行', qty: 1, unitPrice: 120000, taxRate: 10 },
]

const input = 'w-full rounded-md border border-line bg-white px-2 py-2 text-sm'
const label = 'block text-xs text-muted'

function loadIssuer(): Issuer {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_ISSUER, ...(JSON.parse(raw) as Partial<Issuer>) }
  } catch {
    /* 保存された内容が読めなくても、既定値で動く */
  }
  return DEFAULT_ISSUER
}

export default function IssueView({ invoices, defaultDate, onIssued, onLoadSample, onOpenImport, loadingSample }: Props) {
  const [history, setHistory] = useState(loadHistory) // 発行の履歴（このブラウザに保存）
  const candidates = useMemo(() => mergeCandidates(candidatesFromInvoices(invoices), history.clients), [invoices, history.clients])
  const [issuer, setIssuer] = useState<Issuer>(loadIssuer)
  const [clientName, setClientName] = useState('')
  const [clientKana, setClientKana] = useState('')
  const [issueDate, setIssueDate] = useState(defaultDate)
  const [dueDate, setDueDate] = useState(defaultDueDate(defaultDate))
  const [dueEdited, setDueEdited] = useState(false)
  const [lines, setLines] = useState<LineInput[]>(SAMPLE_LINES)
  const [note, setNote] = useState('')
  const [addToData, setAddToData] = useState(invoices !== null)
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(issuer))
    } catch {
      /* 保存できない環境でも動く */
    }
  }, [issuer])

  useEffect(() => {
    if (!dueEdited) setDueDate(defaultDueDate(issueDate))
  }, [issueDate, dueEdited])

  useEffect(() => {
    saveHistory(history)
  }, [history])

  // 発行画面を開いたあとでデータが読み込まれたら、「請求データへ追加」を選べる状態（既定はオン）にする
  const hasData = invoices !== null
  useEffect(() => {
    setAddToData(hasData)
  }, [hasData])

  // 請求番号は、読み込んだデータの番号と、このブラウザで発行済みの番号の続きから採番する
  const invoiceNo = useMemo(
    () => nextInvoiceNo([...(invoices ?? []).map((i) => i.invoiceNo), ...history.nos], issueDate),
    [invoices, history.nos, issueDate],
  )
  const known = findExact(candidates, clientName) // 候補にある取引先か（なければ新規）
  const kana = known?.kana ?? clientKana.trim()
  const draft: InvoiceDraft = { issuer, client: clientName.trim(), invoiceNo, issueDate, dueDate, lines, note }
  const totals = calcInvoice(lines)

  const setLine = (i: number, patch: Partial<LineInput>) => setLines((ls) => ls.map((l, n) => (n === i ? { ...l, ...patch } : l)))

  const issue = async () => {
    setDone(null)
    setFailed(null)
    const problems = validateDraft(draft)
    setIssues(problems.map((p) => p.message))
    if (problems.length > 0) return
    setBusy(true)
    try {
      const blob = await buildInvoicePdf(draft)
      const name = pdfFileName(draft)
      downloadBlob(blob, name)
      setHistory((h) => addIssued(h, { name: draft.client, kana }, draft.invoiceNo))
      if (addToData) {
        onIssued({
          client: draft.client, ...(kana ? { clientKana: kana } : {}), invoiceNo: draft.invoiceNo, issueDate: draft.issueDate, amount: totals.total,
          dueDate: draft.dueDate, paidDate: null, paidAmount: 0,
        })
      }
      setDone(`${name} を作成しました（${yen(totals.total)}）${addToData ? '。請求データにも追加しました' : ''}`)
    } catch {
      setFailed('PDFを作成できませんでした。ネットワークを確認して、もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {invoices === null && (
        <div className="rounded-xl border border-amber bg-amber/10 p-4 text-sm">
          <p className="font-semibold text-navy">請求データがまだ読み込まれていません</p>
          <p className="mt-1 text-muted">
            このままでもPDFは作れますが、データを読み込むまでは次の機能が使えません。
          </p>
          <ul className="mt-1 list-disc pl-5 text-muted">
            <li>宛先の候補（取引先の一覧）。過去に発行した宛先は、データがなくても候補に出ます</li>
            <li>請求番号を、読み込んだデータの番号の続きから採番すること（いまは 001 から始まります）</li>
            <li>発行した請求書を、売掛金・回収予定に反映すること</li>
          </ul>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={onLoadSample}
              disabled={loadingSample}
              className="rounded-md bg-amber px-4 py-2 font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {loadingSample ? '読み込み中…' : 'サンプルデータを読み込む'}
            </button>
            <button onClick={onOpenImport} className="rounded-md border border-navy px-4 py-2 font-semibold text-navy hover:bg-navy/5">
              CSVを取り込む
            </button>
          </div>
        </div>
      )}

      <Card title="宛先と日付" note="請求番号は「INV-年月-連番」で自動的に採番されます。">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className={`${label} sm:col-span-2`}>
            <label>
              宛先（取引先）
              <span className="ml-2 text-muted">名前の一部や、フリガナ（頭文字でも可）で絞り込めます。↑↓とEnterでも選べます</span>
            </label>
            <div className="mt-1">
              <ClientCombobox
                value={clientName}
                onChange={setClientName}
                onPick={(c) => { setClientName(c.name); setClientKana(c.kana ?? '') }}
                candidates={candidates}
                placeholder={candidates.length > 0 ? '例：物流、あるふぁ、と' : '例：株式会社〇〇（データを読み込むと候補が出ます）'}
              />
            </div>
            {clientName.trim() && !known && (
              <div className="mt-2 grid gap-1 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-3">
                <span className="text-muted">新しい取引先として発行します。フリガナ（任意）：</span>
                <input
                  className={input}
                  value={clientKana}
                  onChange={(e) => setClientKana(e.target.value)}
                  placeholder="例：カブシキガイシャマルマル（次回から読みで検索できます）"
                />
              </div>
            )}
          </div>
          <label className={label}>
            請求番号（自動）
            <input className={`${input} bg-paper`} value={invoiceNo} readOnly />
          </label>
          <label className={label}>
            発行日
            <input type="date" className={input} value={issueDate} onChange={(e) => e.target.value && setIssueDate(e.target.value)} />
          </label>
          <label className={label}>
            支払期日（既定は発行日の翌月末）
            <input type="date" className={input} value={dueDate} onChange={(e) => { setDueEdited(true); setDueDate(e.target.value) }} />
          </label>
        </div>
      </Card>

      <Card title="明細" note="消費税は、税率ごとの合計に対して1回だけ切り捨てて計算します。">
        <div className="mt-3 space-y-3">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-paper p-3 md:grid-cols-[1fr_5rem_7rem_6rem_7rem_auto] md:items-end">
              <label className={`${label} col-span-2 md:col-span-1`}>
                品目
                <input className={input} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} />
              </label>
              <label className={label}>
                数量
                <input className={input} type="number" min="0" step="any" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
              </label>
              <label className={label}>
                単価（円）
                <input className={input} type="number" min="0" value={l.unitPrice} onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })} />
              </label>
              <label className={label}>
                税率
                <select className={input} value={l.taxRate} onChange={(e) => setLine(i, { taxRate: Number(e.target.value) as TaxRate })}>
                  <option value={10}>10%</option>
                  <option value={8}>8%（軽減）</option>
                  <option value={0}>非課税</option>
                </select>
              </label>
              <div className="text-sm">
                <div className="text-xs text-muted">金額</div>
                <div className="py-2 font-semibold">{yen(totals.lines[i]?.amount ?? 0)}</div>
              </div>
              <button
                onClick={() => setLines((ls) => ls.filter((_, n) => n !== i))}
                className="justify-self-end rounded-md border border-line px-3 py-2 text-xs text-muted hover:bg-white"
                aria-label={`明細${i + 1}行目を削除`}
              >
                削除
              </button>
            </div>
          ))}
          <button
            onClick={() => setLines((ls) => [...ls, { name: '', qty: 1, unitPrice: 0, taxRate: 10 }])}
            disabled={lines.length >= 30}
            className="rounded-md border border-navy px-3 py-2 text-sm font-semibold text-navy hover:bg-navy/5 disabled:opacity-40"
          >
            ＋ 明細を追加
          </button>
        </div>

        <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          {totals.groups.map((g) => (
            <div key={g.rate} className="flex justify-between gap-4">
              <dt className="text-muted">{g.rate === 0 ? '非課税対象' : `${g.rate}%対象`} 小計{g.rate !== 0 && `／消費税 ${yen(g.tax)}`}</dt>
              <dd>{yen(g.subtotal)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4"><dt className="text-muted">小計（税抜）</dt><dd>{yen(totals.subtotal)}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-muted">消費税</dt><dd>{yen(totals.tax)}</dd></div>
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold text-navy"><dt>合計（税込）</dt><dd>{yen(totals.total)}</dd></div>
        </dl>
      </Card>

      <Card title="発行元・お振込先・備考" note="入力した発行元は、このブラウザに保存されます（サーバーには送りません）。">
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className={label}>
            発行元の会社名
            <input className={input} value={issuer.name} onChange={(e) => setIssuer({ ...issuer, name: e.target.value })} />
          </label>
          <label className={label}>
            登録番号（適格請求書発行事業者。任意）
            <input className={input} value={issuer.registrationNo} placeholder="T1234567890123" onChange={(e) => setIssuer({ ...issuer, registrationNo: e.target.value.trim() })} />
          </label>
          <label className={label}>
            住所
            <input className={input} value={issuer.address} onChange={(e) => setIssuer({ ...issuer, address: e.target.value })} />
          </label>
          <label className={label}>
            電話番号
            <input className={input} value={issuer.tel} onChange={(e) => setIssuer({ ...issuer, tel: e.target.value })} />
          </label>
          <label className={label}>
            お振込先（複数行可）
            <textarea className={input} rows={3} value={issuer.bank} onChange={(e) => setIssuer({ ...issuer, bank: e.target.value })} />
          </label>
          <label className={label}>
            備考
            <textarea className={input} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="例：振込手数料はご負担ください" />
          </label>
        </div>
      </Card>

      <Card>
        <label className={`flex items-start gap-2 text-sm ${invoices ? '' : 'text-muted'}`}>
          <input type="checkbox" className="mt-1" checked={addToData && invoices !== null} disabled={invoices === null} onChange={(e) => setAddToData(e.target.checked)} />
          <span>発行と同時に、請求データへ追加する（売掛金・回収予定に反映されます）{invoices === null && '　※データを読み込むと選べます'}</span>
        </label>

        {issues.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 rounded-md bg-overdue/10 px-6 py-2 text-sm text-overdue">
            {issues.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        )}
        {failed && <p className="mt-3 text-sm text-overdue">{failed}</p>}
        {done && <p className="mt-3 rounded-md bg-paid/10 px-3 py-2 text-sm text-paid">{done}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={issue}
            disabled={busy}
            className="rounded-md bg-navy px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'PDFを作成中…' : '請求書PDFを作成'}
          </button>
          <span className="text-xs text-muted">初回は日本語フォントを読み込むため、数秒かかります。</span>
        </div>
      </Card>
    </div>
  )
}
