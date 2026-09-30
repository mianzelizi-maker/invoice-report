import { createClaudeCall } from './_claude.js'
import { handleGenerate, handleStatus, hashVisitor, limiterFromEnv, MAX_BODY_CHARS, type Deps } from './_core.js'

// Vercel の関数（Web標準の fetch ハンドラ）。
//   GET  /api/insights … AIが使えるか・今日あと何回使えるか（Claudeは呼ばない）
//   POST /api/insights … 集計値を受け取り、上限内ならAIで月次レポートの文章を作る
// APIキーは Vercel の環境変数（ANTHROPIC_API_KEY）だけに置く。ブラウザには一切渡らない。

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })

export default {
  async fetch(request: Request): Promise<Response> {
    const env = process.env
    // 別のサイトのページから呼び出されるのを避ける（ブラウザは Origin を付けて送る）
    const origin = request.headers.get('origin')
    if (origin) {
      try {
        const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? new URL(request.url).host
        if (new URL(origin).host !== host) return json(403, { error: 'forbidden' })
      } catch {
        return json(403, { error: 'forbidden' })
      }
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
    const deps: Deps = {
      env,
      limiter: limiterFromEnv(env),
      callClaude: (args) => createClaudeCall(env.ANTHROPIC_API_KEY ?? '')(args),
      now: () => new Date(),
    }
    const visitor = await hashVisitor(ip)

    if (request.method === 'GET') {
      const r = await handleStatus(deps, visitor)
      return json(r.status, r.body)
    }
    if (request.method === 'POST') {
      const len = Number(request.headers.get('content-length') ?? 0)
      if (len > MAX_BODY_CHARS * 4) return json(413, { error: 'too_large' })
      const r = await handleGenerate(deps, visitor, await request.text())
      return json(r.status, r.body)
    }
    return json(405, { error: 'method_not_allowed' })
  },
}
