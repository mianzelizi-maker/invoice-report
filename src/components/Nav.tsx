export type View = 'overview' | 'invoices' | 'clients'

export const VIEWS: { id: View; label: string }[] = [
  { id: 'overview', label: '概要' },
  { id: 'invoices', label: '請求書一覧' },
  { id: 'clients', label: '取引先別' },
]

type Props = { view: View; onChange: (v: View) => void; disabled: boolean }

/** PC：左サイドバー */
export function Sidebar({ view, onChange, disabled }: Props) {
  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col bg-navy text-white md:flex">
      <div className="px-5 py-6">
        <div className="text-xs tracking-widest text-white/60">ACCOUNTS RECEIVABLE</div>
        <h1 className="mt-1 text-lg font-bold leading-snug">請求・入金<br />管理レポート</h1>
      </div>
      <nav className="flex flex-col gap-1 px-3">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            disabled={disabled}
            onClick={() => onChange(v.id)}
            className={`rounded-md px-3 py-2 text-left text-sm disabled:opacity-40 ${
              view === v.id ? 'bg-white/15 font-semibold' : 'text-white/75 hover:bg-white/10'
            }`}
          >
            {v.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}

/** スマホ：下部タブバー */
export function BottomNav({ view, onChange, disabled }: Props) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-navy-soft bg-navy text-white md:hidden">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          disabled={disabled}
          onClick={() => onChange(v.id)}
          className={`flex-1 py-3 text-xs disabled:opacity-40 ${
            view === v.id ? 'border-t-2 border-amber font-bold' : 'border-t-2 border-transparent text-white/70'
          }`}
        >
          {v.label}
        </button>
      ))}
    </nav>
  )
}
