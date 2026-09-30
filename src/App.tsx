import { useState } from 'react'
import type { Invoice } from './types'
import { SAMPLE_AS_OF, loadSample } from './lib/csv'
import { BottomNav, Sidebar, type View } from './components/Nav'
import TopBar from './components/TopBar'
import EmptyState from './components/EmptyState'
import Overview from './components/Overview'
import InvoiceList from './components/InvoiceList'
import ClientView from './components/ClientView'

const today = () => new Date().toISOString().slice(0, 10)

export default function App() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [asOf, setAsOf] = useState(today)
  const [view, setView] = useState<View>('overview')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSample = async () => {
    setLoading(true)
    setError(null)
    try {
      setInvoices(await loadSample())
      setAsOf(SAMPLE_AS_OF) // サンプルは基準日に固定すると毎回同じ結果になる
      setView('overview')
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const nav = { view, onChange: setView, disabled: invoices === null }

  return (
    <div className="min-h-screen md:flex">
      <Sidebar {...nav} />
      <div className="min-w-0 flex-1">
        <TopBar asOf={asOf} onAsOfChange={setAsOf} onSample={handleSample} loading={loading} hasData={invoices !== null} />
        <main className="mx-auto max-w-5xl px-4 pt-4 pb-24 md:pb-8">
          {!invoices ? (
            <EmptyState onSample={handleSample} loading={loading} error={error} />
          ) : view === 'overview' ? (
            <Overview invoices={invoices} asOf={asOf} />
          ) : view === 'invoices' ? (
            <InvoiceList invoices={invoices} asOf={asOf} />
          ) : (
            <ClientView invoices={invoices} asOf={asOf} />
          )}
        </main>
      </div>
      <BottomNav {...nav} />
    </div>
  )
}
