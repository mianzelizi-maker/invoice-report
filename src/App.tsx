import { useMemo, useState } from 'react'
import type { Row } from './types'
import { loadSample } from './lib/csv'
import { byClient, byMedia, byMonth, prevMonth, sumRows, uniqueSorted } from './lib/aggregate'
import Header from './components/Header'
import EmptyState from './components/EmptyState'
import Filters, { ALL, type FilterState } from './components/Filters'
import KpiCards from './components/KpiCards'
import Charts from './components/Charts'
import SummaryTable from './components/SummaryTable'

export default function App() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterState>({ month: ALL, client: ALL, media: ALL })

  const handleSample = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await loadSample()
      setRows(data)
      const latest = uniqueSorted(data, (r) => r.month).at(-1) ?? ALL
      setFilter({ month: latest, client: ALL, media: ALL })
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const view = useMemo(() => {
    if (!rows) return null
    const scoped = rows.filter(
      (r) => (filter.client === ALL || r.client === filter.client) && (filter.media === ALL || r.media === filter.media),
    )
    const single = filter.month !== ALL
    const inMonth = single ? scoped.filter((r) => r.month === filter.month) : scoped
    const prevRows = single ? scoped.filter((r) => r.month === prevMonth(filter.month)) : []
    return {
      months: uniqueSorted(rows, (r) => r.month),
      clients: uniqueSorted(rows, (r) => r.client),
      medias: uniqueSorted(rows, (r) => r.media),
      single,
      cur: sumRows(inMonth),
      prev: prevRows.length > 0 ? sumRows(prevRows) : null,
      monthly: byMonth(scoped),
      client: byClient(inMonth),
      media: byMedia(inMonth),
    }
  }, [rows, filter])

  return (
    <div className="min-h-screen">
      <Header onSample={handleSample} loading={loading} hasData={rows !== null} />
      <main className="mx-auto max-w-6xl space-y-4 px-4 py-4">
        {!view ? (
          <EmptyState onSample={handleSample} loading={loading} error={error} />
        ) : (
          <>
            <Filters value={filter} months={view.months} clients={view.clients} medias={view.medias} onChange={setFilter} />
            <KpiCards cur={view.cur} prev={view.prev} />
            <Charts monthly={view.monthly} media={view.media} clients={view.client} singleMonth={view.single} />
            <SummaryTable client={view.client} media={view.media} month={view.monthly} />
          </>
        )}
      </main>
    </div>
  )
}
