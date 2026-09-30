import type { Invoice } from '../types'

/** 宛先の候補。kana はフリガナ（任意） */
export type ClientCandidate = { name: string; kana?: string }

/**
 * 検索用にそろえる：全角/半角（英数字・カナ・記号）、大文字/小文字、ひらがな/カタカナ、空白の違いをなくす。
 * 例：「ｱﾙﾌｧ」「あるふぁ」「アルファ」はすべて「アルファ」になる。
 */
export function normalizeForSearch(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60)) // ひらがな → カタカナ
    .replace(/\s+/g, '')
}

const isSingleKana = (q: string) => [...q].length === 1 && /^[ァ-ヺ]$/.test(q)

/**
 * 候補を絞り込む。
 * - 名前・フリガナのどちらかに、入力が含まれていれば候補に出す（例：「物流」→ アルファ物流）
 * - ただし、かな1文字だけのときは「頭文字」とみなして、先頭が一致するものだけにする（例：「と」→ 東和建設）
 * - 先頭が一致するものを上に、それ以外は下に並べる。入力が空なら全件（読み順）
 */
export function filterClients(candidates: ClientCandidate[], query: string): ClientCandidate[] {
  const q = normalizeForSearch(query)
  const byReading = (a: ClientCandidate, b: ClientCandidate) =>
    normalizeForSearch(a.kana || a.name).localeCompare(normalizeForSearch(b.kana || b.name), 'ja')
  if (!q) return [...candidates].sort(byReading)

  const initialOnly = isSingleKana(q)
  const ranked: { c: ClientCandidate; rank: number }[] = []
  for (const c of candidates) {
    const name = normalizeForSearch(c.name)
    const kana = normalizeForSearch(c.kana ?? '')
    if (name.startsWith(q) || kana.startsWith(q)) ranked.push({ c, rank: 0 })
    else if (!initialOnly && (name.includes(q) || kana.includes(q))) ranked.push({ c, rank: 1 })
  }
  return ranked.sort((a, b) => a.rank - b.rank || byReading(a.c, b.c)).map((r) => r.c)
}

/** 請求データから、取引先ごとの候補（フリガナは最初に見つかったもの）を作る */
export function candidatesFromInvoices(invoices: Invoice[] | null): ClientCandidate[] {
  const map = new Map<string, ClientCandidate>()
  for (const i of invoices ?? []) {
    const cur = map.get(i.client)
    if (!cur) map.set(i.client, { name: i.client, ...(i.clientKana ? { kana: i.clientKana } : {}) })
    else if (!cur.kana && i.clientKana) cur.kana = i.clientKana
  }
  return [...map.values()]
}

/** 候補を合体する。同じ名前は1つにまとめ、フリガナは持っているほうを残す */
export function mergeCandidates(...lists: ClientCandidate[][]): ClientCandidate[] {
  const map = new Map<string, ClientCandidate>()
  for (const list of lists) {
    for (const c of list) {
      const cur = map.get(c.name)
      if (!cur) map.set(c.name, { ...c })
      else if (!cur.kana && c.kana) cur.kana = c.kana
    }
  }
  return [...map.values()]
}

/** 入力された名前と同じ（表記ゆれを除いて）候補を探す */
export function findExact(candidates: ClientCandidate[], name: string): ClientCandidate | undefined {
  const n = normalizeForSearch(name)
  return n ? candidates.find((c) => normalizeForSearch(c.name) === n) : undefined
}
