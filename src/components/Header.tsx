type Props = { onSample: () => void; loading: boolean; hasData: boolean }

export default function Header({ onSample, loading, hasData }: Props) {
  return (
    <header className="bg-white border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold sm:text-xl">案件収支レポート</h1>
          <p className="text-xs text-muted">広告・SNS運用代行 クライアント別／媒体別／月別</p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${import.meta.env.BASE_URL}sample.csv`}
            download="sample.csv"
            className="rounded-md border border-line px-3 py-2 text-sm hover:bg-bg"
          >
            サンプルCSV
          </a>
          <button
            onClick={onSample}
            disabled={loading}
            className="rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {hasData ? 'サンプルを再読込' : 'サンプルデータで試す'}
          </button>
        </div>
      </div>
    </header>
  )
}
