import { useId, useMemo, useRef, useState } from 'react'
import { filterClients, type ClientCandidate } from '../lib/clientSearch'

type Props = {
  value: string
  onChange: (text: string) => void
  onPick: (c: ClientCandidate) => void
  candidates: ClientCandidate[]
  placeholder?: string
}

const MAX_SHOWN = 30

/** 入力に応じて候補を絞り込む入力欄。↑↓で選び、Enterで決定、Escで閉じる */
export default function ClientCombobox({ value, onChange, onPick, candidates, placeholder }: Props) {
  const id = useId()
  const listId = `${id}-list`
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const listRef = useRef<HTMLUListElement>(null)

  const shown = useMemo(() => filterClients(candidates, value).slice(0, MAX_SHOWN), [candidates, value])
  const visible = open && shown.length > 0

  const pick = (c: ClientCandidate) => {
    onPick(c)
    setOpen(false)
    setActive(-1)
  }

  const move = (delta: number) => {
    if (shown.length === 0) return
    setOpen(true)
    const next = active < 0 ? (delta > 0 ? 0 : shown.length - 1) : (active + delta + shown.length) % shown.length
    setActive(next)
    // 選択中の候補が見える位置までスクロールする
    listRef.current?.children[next]?.scrollIntoView?.({ block: 'nearest' })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return // 日本語入力の変換中のEnterは、変換の確定として扱う
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1) }
    else if (e.key === 'Enter') {
      if (visible && active >= 0) { e.preventDefault(); pick(shown[active]) }
    } else if (e.key === 'Escape') {
      if (visible) { e.preventDefault(); setOpen(false); setActive(-1) }
    }
  }

  return (
    <div className="relative">
      <input
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={visible && active >= 0 ? `${id}-opt-${active}` : undefined}
        autoComplete="off"
        className="w-full rounded-md border border-line bg-white px-2 py-2 text-sm"
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setActive(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => { setOpen(false); setActive(-1) }}
        onKeyDown={onKeyDown}
      />
      {visible && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-line bg-card shadow-lg"
        >
          {shown.map((c, i) => (
            <li
              key={c.name}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              // クリックで入力欄のフォーカスが外れて候補が消える前に選べるよう、mousedown で決定する
              onMouseDown={(e) => { e.preventDefault(); pick(c) }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? 'bg-navy text-white' : 'hover:bg-paper'}`}
            >
              <div>{c.name}</div>
              {c.kana && <div className={`text-xs ${i === active ? 'text-white/70' : 'text-muted'}`}>{c.kana}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
