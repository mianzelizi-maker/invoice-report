import type { ClientCandidate } from './clientSearch'

/** 発行の履歴。請求データがなくても、次回の宛先の候補と請求番号の続きに使う（このブラウザにだけ保存） */
export type IssueHistory = { clients: ClientCandidate[]; nos: string[] }

const KEY = 'invoice-report:history'
const MAX_CLIENTS = 30
const MAX_NOS = 200

export const emptyHistory = (): IssueHistory => ({ clients: [], nos: [] })

/** 発行した宛先と請求番号を履歴に加える（宛先は新しい順、同じ名前は1つにまとめる） */
export function addIssued(h: IssueHistory, client: ClientCandidate, invoiceNo: string): IssueHistory {
  const prev = h.clients.find((c) => c.name === client.name)
  const kana = client.kana || prev?.kana
  const entry: ClientCandidate = kana ? { name: client.name, kana } : { name: client.name }
  return {
    clients: [entry, ...h.clients.filter((c) => c.name !== client.name)].slice(0, MAX_CLIENTS),
    nos: [...h.nos.filter((n) => n !== invoiceNo), invoiceNo].slice(-MAX_NOS),
  }
}

const isStr = (v: unknown): v is string => typeof v === 'string'

export function loadHistory(): IssueHistory {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return emptyHistory()
    const r = raw as { clients?: unknown; nos?: unknown }
    const clients = Array.isArray(r.clients)
      ? r.clients.flatMap((c): ClientCandidate[] =>
          typeof c === 'object' && c !== null && isStr((c as ClientCandidate).name) && (c as ClientCandidate).name
            ? [{ name: (c as ClientCandidate).name, ...(isStr((c as ClientCandidate).kana) && (c as ClientCandidate).kana ? { kana: (c as ClientCandidate).kana } : {}) }]
            : [],
        )
      : []
    return { clients: clients.slice(0, MAX_CLIENTS), nos: Array.isArray(r.nos) ? r.nos.filter(isStr).slice(-MAX_NOS) : [] }
  } catch {
    return emptyHistory() // 保存内容が壊れている・保存できない環境でも動く
  }
}

export function saveHistory(h: IssueHistory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(h))
  } catch {
    /* 保存できなくても、その回の画面では履歴が使える */
  }
}
