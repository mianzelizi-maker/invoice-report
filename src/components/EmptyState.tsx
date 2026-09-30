type Props = { onSample: () => void; loading: boolean; error: string | null }

export default function EmptyState({ onSample, loading, error }: Props) {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-6 text-center sm:p-10">
      <h2 className="text-xl font-bold">毎月の案件集計を、ひと目で。</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        広告費・問い合わせ数・CV数・月額報酬・外注費のデータから、
        CPA・粗利・粗利率をクライアント別／媒体別／月別に自動で集計します。
        まずはサンプルデータで動きを確認できます。
      </p>
      <button
        onClick={onSample}
        disabled={loading}
        className="mt-6 rounded-md bg-brand px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {loading ? '読み込み中…' : 'サンプルデータで試す'}
      </button>
      {error && <p className="mt-4 text-sm text-bad">{error}</p>}
    </div>
  )
}
