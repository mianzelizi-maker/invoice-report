import { parseAiText, type ReportData, type ReportSection } from './report'

/** AI生成が使えるか（サーバーに問い合わせる。Claudeは呼ばないので料金はかからない） */
export type AiStatus =
  | { available: true; remaining: number; limit: number }
  | { available: false; reason: 'unavailable' | 'limit' | 'error' }

export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatus> {
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
