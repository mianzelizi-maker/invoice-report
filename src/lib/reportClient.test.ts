import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchAiStatus, requestAiReport } from './reportClient'

afterEach(() => vi.unstubAllGlobals())

describe('AI生成の無効設定（既定）', () => {
  it('VITE_ENABLE_AI が未設定なら、サーバーへ通信せず「使えない」を返す', async () => {
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    expect(await fetchAiStatus()).toEqual({ available: false, reason: 'unavailable' })
    expect(await requestAiReport({} as never)).toEqual({ ok: false, reason: 'unavailable' })
    expect(spy).not.toHaveBeenCalled()
  })
})
