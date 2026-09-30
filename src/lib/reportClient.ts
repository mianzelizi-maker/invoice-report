import { parseAiText, type ReportData, type ReportSection } from './report'

/** AI生成が使えるか（サーバーに問い合わせる。Claudeは呼ばないので料金はかからない） */
export type AiStatus =
  | { available: true; remaining: number; limit: number }
  | { available: false; reason: 'unavailable' | 'limit' | 'error' }

/**
 * AI生成を使うかどうかは、ビルド時の設定（VITE_ENABLE_AI=true）で決める。既定は「使わない」。
 * 使わない設定のときは、サーバーへ通信もしない（GitHub Pagesのような静的な公開でも、余計な通信が出ない）。
 */
export const AI_ENABLED = import.meta.env.VITE_ENABLE_AI === 'true'

export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatus> {
  if (!AI_ENABLED) return { available: false, reason: 'unavailable' }
  try {
    const res = await fetch('/api/insights', { signal })
    // ローカル実行（npm run dev）では /api が無く、index.html が返る
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { available: false, reason: 'unavailable' }
    const j = (await res.json()) as { available?: boolean; remaining?: number; limit?: number; reason?: string }
    if (j.available) return { available: true, remaining: j.remaining ?? 0, limit: j.limit ?? 0 }
    return { available: false, reason: j.reason === 'limit' ? 'limit' : 'unavailable' }
  } catch {
    return { available: false, reason: 'error' }
  }
}

export type AiResult =
  | { ok: true; sections: ReportSection[]; remaining: number }
  | { ok: false; reason: 'limit' | 'unavailable' | 'error' }

export async function requestAiReport(data: ReportData): Promise<AiResult> {
  if (!AI_ENABLED) return { ok: false, reason: 'unavailable' }
  try {
    const res = await fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.status === 429) return { ok: false, reason: 'limit' }
    if (res.status === 503) return { ok: false, reason: 'unavailable' }
    if (!res.ok) return { ok: false, reason: 'error' }
    const j = (await res.json()) as { text?: string; remaining?: number }
    const sections = parseAiText(j.text ?? '')
    if (sections.length === 0) return { ok: false, reason: 'error' }
    return { ok: true, sections, remaining: j.remaining ?? 0 }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
