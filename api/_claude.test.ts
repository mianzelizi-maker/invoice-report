import { describe, expect, it } from 'vitest'
import { buildRequest } from './_claude'

const args = { system: 'S', user: 'U' }

describe('Claudeへのリクエスト', () => {
  it('Haiku 4.5：effort を付けず、出力は1500トークンまで', () => {
    const r = buildRequest({ ...args, model: 'claude-haiku-4-5' })
    expect(r).not.toHaveProperty('output_config')
    expect(r).not.toHaveProperty('thinking')
    expect(r.max_tokens).toBe(1500)
    expect(r.messages).toEqual([{ role: 'user', content: 'U' }])
    expect(r.system).toBe('S')
  })
  it('それ以外のモデル：effort は low、出力は4000トークンまで', () => {
    const r = buildRequest({ ...args, model: 'claude-sonnet-5-5' })
    expect(r).toMatchObject({ output_config: { effort: 'low' }, max_tokens: 4000 })
  })
  it('温度などの余計なパラメータや、ツール・ストリーミングは使わない', () => {
    const r = buildRequest({ ...args, model: 'claude-haiku-4-5' })
    expect(Object.keys(r).sort()).toEqual(['max_tokens', 'messages', 'model', 'system'])
  })
})
