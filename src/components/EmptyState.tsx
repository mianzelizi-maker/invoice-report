type Props = { onSample: () => void; loading: boolean; error: string | null }

const RULES: [string, string][] = [
  ['入金済み', '請求額の全額が入金されている'],
  ['一部入金', '入金はあるが、請求額に届いていない'],
  ['未入金', 'まだ入金がない（期日前）'],
  ['支払遅延', '残高があり、支払期日を過ぎている（一部入金でも遅延なら「一部入金・遅延」）'],
]

export default function EmptyState({ onSample, loading, error }: Props) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-line bg-card p-6 sm:p-10">
      <h2 className="text-xl font-bold text-navy">売掛金の「いま」を、ひと目で。</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        請求書データから入金状況を自動で判定し、取引先ごとの売掛金残高・今月の回収予定・
        支払いが遅れがちな取引先を見える化します。まずはサンプルデータで動きを確認できます。
      </p>
      <button
        onClick={onSample}
        disabled={loading}
        className="mt-6 rounded-md bg-amber px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? '読み込み中…' : 'サンプルデータで試す'}
      </button>
      {error && <p className="mt-4 text-sm text-overdue">{error}</p>}
      <dl className="mt-8 space-y-2 border-t border-line pt-5 text-sm">
        {RULES.map(([k, v]) => (
          <div key={k} className="flex gap-3">
            <dt className="w-20 shrink-0 font-semibold text-navy">{k}</dt>
            <dd className="text-muted">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
