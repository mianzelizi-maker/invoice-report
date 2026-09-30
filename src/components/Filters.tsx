import { monthLabel } from '../lib/format'

export type FilterState = { month: string; client: string; media: string }
export const ALL = 'all'

type Props = {
  value: FilterState
  months: string[]
  clients: string[]
  medias: string[]
  onChange: (v: FilterState) => void
}

const selectCls = 'w-full rounded-md border border-line bg-white px-2 py-2 text-sm'

export default function Filters({ value, months, clients, medias, onChange }: Props) {
  const set = (patch: Partial<FilterState>) => onChange({ ...value, ...patch })
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="text-xs text-muted">
        対象月
        <select className={selectCls} value={value.month} onChange={(e) => set({ month: e.target.value })}>
          {[...months].reverse().map((m) => (
            <option key={m} value={m}>{monthLabel(m)}</option>
          ))}
          <option value={ALL}>全期間</option>
        </select>
      </label>
      <label className="text-xs text-muted">
        クライアント
        <select className={selectCls} value={value.client} onChange={(e) => set({ client: e.target.value })}>
          <option value={ALL}>すべて</option>
          {clients.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-xs text-muted">
        媒体
        <select className={selectCls} value={value.media} onChange={(e) => set({ media: e.target.value })}>
          <option value={ALL}>すべて</option>
          {medias.map((m) => <option key={m}>{m}</option>)}
        </select>
      </label>
    </div>
  )
}
