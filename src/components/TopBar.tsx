import { SAMPLE_AS_OF } from '../lib/csv'
import { dateLabel } from '../lib/format'

type Props = {
  asOf: string
  onAsOfChange: (d: string) => void
  onSample: () => void
  loading: boolean
  hasData: boolean
}

export default function TopBar({ asOf, onAsOfChange, onSample, loading, hasData }: Props) {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3">
        <h1 className="text-base font-bold text-navy md:hidden">請求・入金管理レポート</h1>
        <label className="flex items-center gap-2 text-xs text-muted">
          基準日
          <input
            type="date"
            value={asOf}
            onChange={(e) => e.target.value && onAsOfChange(e.target.value)}
            className="rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink"
          />
          {asOf !== SAMPLE_AS_OF && hasData && (
            <button className="text-navy underline" onClick={() => onAsOfChange(SAMPLE_AS_OF)}>
              {dateLabel(SAMPLE_AS_OF)}に戻す
            </button>
          )}
        </label>
        <button
          onClick={onSample}
          disabled={loading}
          className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {hasData ? 'サンプルを再読込' : 'サンプルデータで試す'}
        </button>
      </div>
    </header>
  )
}
