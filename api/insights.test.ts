import { afterEach, describe, expect, it, vi } from 'vitest'
import handler from './insights'

const call = (init: RequestInit & { headers?: Record<string, string> } = {}) =>
  handler.fetch(new Request('https://demo.example.com/api/insights', { headers: { host: 'demo.example.com', ...init.headers }, ...init }))

afterEach(() => vi.unstubAllEnvs())

describe('/api/insights（キー未設定の公開版）', () => {
  it('GET：AIは使えない状態を返す（エラーにしない。画面はルールベースを出す）', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const res = await call()
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ available: false, reason: 'not_configured' })
  })
  it('POST：503（Claudeは呼ばれない）', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const res = await call({ method: 'POST', body: '{}' })
    expect(res.status).toBe(503)
  })
  it('キーだけあって回数カウンタが無い場合も無効', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
    vi.stubEnv('UPSTASH_REDIS_REST_URL', '')
    vi.stubEnv('KV_REST_API_URL', '')
    const res = await call()
    expect(await res.json()).toMatchObject({ available: false, reason: 'limiter_not_configured' })
  })
})

describe('/api/insights（入口の検査）', () => {
  it('別サイトからの呼び出し（Origin が違う）は 403', async () => {
    const res = await call({ headers: { origin: 'https://evil.example.org' } })
    expect(res.status).toBe(403)
  })
  it('同じサイトからの呼び出しは通る', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const res = await call({ headers: { origin: 'https://demo.example.com' } })
    expect(res.status).toBe(200)
  })
  it('GET/POST 以外は 405', async () => {
    expect((await call({ method: 'DELETE' })).status).toBe(405)
  })
  it('応答はキャッシュされない', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    expect((await call()).headers.get('cache-control')).toBe('no-store')
  })
})
