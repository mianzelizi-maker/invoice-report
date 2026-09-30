import Anthropic from '@anthropic-ai/sdk'
import type { ClaudeCall } from './_core.js'

// 出力の上限（固定）。既定の Haiku は思考を使わないので短くてよい。
// 他のモデル（AI_MODEL で切り替えた場合）は思考の分も含むため余裕をもたせる。
const MAX_OUTPUT_TOKENS_HAIKU = 1500
const MAX_OUTPUT_TOKENS_OTHER = 4000

export const isHaiku = (model: string) => model.includes('haiku')

/** Claude に送るリクエストの組み立て（SDKを呼ばないのでテストできる） */
export function buildRequest(args: { system: string; user: string; model: string }) {
  return {
    model: args.model,
    max_tokens: isHaiku(args.model) ? MAX_OUTPUT_TOKENS_HAIKU : MAX_OUTPUT_TOKENS_OTHER,
    system: args.system,
    messages: [{ role: 'user' as const, content: args.user }],
    // 要約タスクなので思考は浅くてよい。Haiku 4.5 は effort に非対応のため付けない
    ...(isHaiku(args.model) ? {} : { output_config: { effort: 'low' as const } }),
  }
}

export function createClaudeCall(apiKey: string): ClaudeCall {
  // リトライは行わない（失敗時に2重に課金されないように）。30秒で打ち切る
  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 30_000 })
  return async (args) => {
    const res = await client.messages.create(buildRequest(args))
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return { text, refused: res.stop_reason === 'refusal' }
  }
}
