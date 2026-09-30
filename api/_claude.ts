import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeCall } from './_core.js'

// 出力の上限。思考（thinking）の分も含むので、文章（約15行）に対して余裕をもたせつつ固定する
const MAX_OUTPUT_TOKENS = 4000

export function createClaudeCall(apiKey: string): ClaudeCall {
  // リトライは行わない（失敗時に2重に課金されないように）。30秒で打ち切る
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 30_000 })
  return async ({ system, user, model }) => {
    const res = await client.messages.create({
      model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      // 要約タスクなので思考は浅くてよい（Haiku 4.5 は effort 非対応のため付けない）
      ...(model.includes('haiku') ? {} : { output_config: { effort: 'low' as const } }),
    })
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return { text, refused: res.stop_reason === 'refusal' }
  }
}
