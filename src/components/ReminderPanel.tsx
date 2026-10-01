import { useEffect, useMemo, useState } from 'react'
import type { Invoice } from '../types'
import { buildReminder } from '../lib/reminder'

/** 督促メールの下書き。内容は編集でき、件名・本文をコピーして使う */
export default function ReminderPanel({ client, invoices, asOf }: { client: string; invoices: Invoice[]; asOf: string }) {
  const reminder = useMemo(() => buildReminder(client, invoices, asOf), [client, invoices, asOf])
  const [text, setText] = useState(reminder?.body ?? '')
  const [copied, setCopied] = useState<'subject' | 'body' | null>(null)

  useEffect(() => setText(reminder?.body ?? ''), [reminder])

  if (!reminder) return <p className="py-2 text-xs text-muted">現在遅延中の請求書はありません。</p>

  const copy = async (kind: 'subject' | 'body') => {
    try {
      await navigator.clipboard.writeText(kind === 'subject' ? reminder.subject : text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // クリップボードが使えない環境では、テキストを選択してコピーしてもらう
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-navy/10 px-2 py-0.5 font-bold text-navy">{reminder.stage}の督促</span>
        <span className="text-muted">最も遅れている請求書の遅延日数で文面を変えています。</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-xs text-muted">件名</span>
        <span className="min-w-0 flex-1 truncate font-semibold">{reminder.subject}</span>
        <button type="button" onClick={() => copy('subject')} className="shrink-0 rounded border border-line bg-card px-2 py-1 text-xs">
          {copied === 'subject' ? 'コピーしました' : '件名をコピー'}
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        aria-label={`${client}への督促文`}
        className="w-full rounded border border-line bg-card p-2 text-sm leading-relaxed"
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted">末尾の（自社名・担当者名）を書き換えてお使いください。</span>
        <button type="button" onClick={() => copy('body')} className="shrink-0 rounded bg-navy px-3 py-1.5 text-xs font-bold text-white">
          {copied === 'body' ? 'コピーしました' : '本文をコピー'}
        </button>
      </div>
    </div>
  )
}
