import { useEffect, useMemo, useState } from 'react'
import type { Invoice } from '../types'
import { buildReportData, reportToText, ruleBasedReport, type Report } from '../lib/report'
import { fetchAiStatus, requestAiReport, type AiStatus } from '../lib/reportClient'
import { pct, yen } from '../lib/format'
import { Card, Kpi } from './ui'

const NOTICE = {
  limit: '本日のAI生成の利用上限に達しました。自動集計の文章を表示しています。',
  unavailable: 'AI生成は、この環境では利用できません（未設定またはローカル実行）。自動集計の文章を表示しています。',
  error: 'AIの文章を作成できませんでした。自動集計の文章を表示しています。',
} as const

function SourceBadge({ source }: { source: Report['source'] }) {
  return source === 'ai' ? (
    <span className="rounded-full bg-amber px-3 py-1 text-xs font-bold text-white">AI生成</span>
  ) : (
    <span className="rounded-full border border-navy px-3 py-1 text-xs font-bold text-navy">自動集計</span>
  )
}

export default function ReportView({ invoices, asOf }: { invoices: Invoice[]; asOf: string }) {
  const data = useMemo(() => buildReportData(invoices, asOf), [invoices, asOf])
  const rule = useMemo(() => ruleBasedReport(data), [data])

  const [ai, setAi] = useState<Report | null>(null)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // データや基準日が変わったら、AIの文章は破棄して自動集計に戻す（古い数字が残らないように）
  useEffect(() => {
    setAi(null)
    setNotice(null)
  }, [data])

  useEffect(() => {
    const ctl = new AbortController()
    void fetchAiStatus(ctl.signal).then(setStatus)
    return () => ctl.abort()
  }, [])

  const report = ai ?? rule

  const generate = async () => {
    setLoading(true)
    setNotice(null)
    const r = await requestAiReport(data)
    if (r.ok) {
      setAi({ source: 'ai', sections: r.sections })
      setStatus((s) => (s?.available ? { ...s, remaining: r.remaining } : s))
      if (r.remaining <= 0) setStatus({ available: false, reason: 'limit' })
    } else {
      setAi(null)
      setNotice(NOTICE[r.reason])
      if (r.reason === 'limit') setStatus({ available: false, reason: 'limit' })
    }
    setLoading(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(reportToText(report, asOf))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setNotice('コピーできませんでした。文章を選択してコピーしてください。')
    }
  }

  const aiButton =
    status === null ? null : status.available ? (
      <button
        onClick={generate}
        disabled={loading}
        className="rounded-md bg-amber px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? 'AIが作成中…' : 'AIで文章を生成'}
      </button>
    ) : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="売掛金残高" value={yen(data.ar)} />
        <Kpi label="支払遅延の残高" value={yen(data.overdueAmount)} sub={`${data.overdueCount}件`} tone={data.overdueCount > 0 ? 'bad' : 'good'} />
        <Kpi label="今月の回収予定" value={yen(data.dueThisMonth.amount)} sub={`${data.dueThisMonth.count}件`} />
        <Kpi label="回収率" value={pct(data.collectionRate)} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-navy">今月の注目ポイント</h2>
            <SourceBadge source={report.source} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {aiButton}
            {ai && (
              <button onClick={() => setAi(null)} className="rounded-md border border-line px-3 py-2 text-sm hover:bg-paper">
                自動集計に戻す
              </button>
            )}
            <button onClick={copy} className="rounded-md border border-line px-3 py-2 text-sm hover:bg-paper">
              {copied ? 'コピーしました' : 'コピー'}
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-muted">
          {report.source === 'ai'
            ? 'AI（Claude）が、上の集計値をもとに作成した文章です。数値は集計値・各画面と照合してご利用ください。'
            : '集計結果から、あらかじめ決めたルールで自動的に作成した文章です（AIは使っていません）。'}
          　基準日 {asOf.replaceAll('-', '/')}
        </p>
        {notice && <p className="mt-2 rounded-md bg-amber/10 px-3 py-2 text-xs text-amber">{notice}</p>}

        <div className="mt-4 space-y-5">
          {report.sections.map((s) => (
            <section key={s.title}>
              <h3 className="border-l-4 border-navy pl-2 text-sm font-bold text-navy">{s.title}</h3>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm leading-relaxed">
                {s.lines.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </Card>

      <p className="text-xs text-muted">
        {status?.available
          ? `AI生成を使うと、集計結果（取引先名・金額など）が Anthropic の API に送信されます（個別の請求書明細は送りません）。本日あと ${status.remaining} 回（1日${status.limit}回まで）。`
          : status?.available === false && status.reason === 'limit'
            ? '本日のAI生成の利用上限に達しています。自動集計の文章はいつでも使えます。'
            : 'このページではAI生成は使えません（未設定またはローカル実行）。自動集計の文章はいつでも使えます。'}
      </p>
    </div>
  )
}
