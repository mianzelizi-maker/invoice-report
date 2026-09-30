import type { Invoice } from '../types'
import {
  aging, arAt, byClient, change, dueInMonth, dueThisMonth, nextMonthOf, prevMonthEnd,
  rankByDelay, rankByOverdueAmount, receivable, summarize,
} from './aggregate'
import { isOverdue } from './status'
import { pct, yen } from './format'

/** レポートのもとになる集計結果。AIに送るのもこの内容だけ（個別の請求書明細は含めない） */
export type ReportData = {
  asOf: string
  ar: number
  arPrevMonthEnd: number
  arChange: number | null
  overdueAmount: number
  overdueCount: number
  collectionRate: number | null
  dueThisMonth: {
    amount: number
    count: number
    top: { client: string; invoiceNo: string; dueDate: string; amount: number; overdue: boolean }[]
  }
  dueNextMonth: { amount: number; count: number }
  aging: { bucket: string; amount: number; count: number }[]
  urgent: { client: string; overdueAmount: number; overdueCount: number; maxOverdueDays: number; partial: boolean }[]
  habitual: { client: string; lateCount: number; evaluableCount: number; avgLateDays: number }[]
}

export type ReportSection = { title: string; lines: string[] }
export type Report = { source: 'rule' | 'ai'; sections: ReportSection[] }

export function buildReportData(invoices: Invoice[], asOf: string): ReportData {
  const s = summarize(invoices, asOf)
  const clients = byClient(invoices, asOf)
  const prevAr = arAt(invoices, prevMonthEnd(asOf))
  const thisMonth = dueThisMonth(invoices, asOf)
  const nextMonth = dueInMonth(invoices, nextMonthOf(asOf))
  const sum = (list: Invoice[]) => list.reduce((a, i) => a + receivable(i), 0)
  return {
    asOf,
    ar: s.ar,
    arPrevMonthEnd: prevAr,
    arChange: change(s.ar, prevAr),
    overdueAmount: s.overdueAmount,
    overdueCount: s.overdueCount,
    collectionRate: s.collectionRate,
    dueThisMonth: {
      amount: s.dueThisMonthAmount,
      count: s.dueThisMonthCount,
      top: [...thisMonth]
        .sort((a, b) => receivable(b) - receivable(a))
        .slice(0, 3)
        .map((i) => ({
          client: i.client, invoiceNo: i.invoiceNo, dueDate: i.dueDate, amount: receivable(i), overdue: isOverdue(i, asOf),
        })),
    },
    dueNextMonth: { amount: sum(nextMonth), count: nextMonth.length },
    aging: aging(invoices, asOf).map((a) => ({ bucket: a.bucket, amount: a.amount, count: a.count })),
    urgent: rankByOverdueAmount(clients, 3).map((c) => ({
      client: c.client, overdueAmount: c.overdueAmount, overdueCount: c.overdueCount,
      maxOverdueDays: c.maxOverdueDays, partial: c.hasPartialOverdue,
    })),
    habitual: rankByDelay(clients, 3).map((c) => ({
      client: c.client, lateCount: c.lateCount, evaluableCount: c.evaluableCount, avgLateDays: Math.round(c.avgLateDays ?? 0),
    })),
  }
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
const monthNo = (asOf: string, offset = 0) => ((Number(asOf.slice(5, 7)) - 1 + offset) % 12) + 1

/** 集計結果から、ルールだけで作る月次レポート（AIやAPIキーがなくても動く） */
export function ruleBasedReport(d: ReportData): Report {
  const sections: ReportSection[] = []

  // 全体の状況
  const overall: string[] = []
  overall.push(
    d.arChange === null
      ? `売掛金残高は${yen(d.ar)}です。`
      : `売掛金残高は${yen(d.ar)}で、前月末（${yen(d.arPrevMonthEnd)}）より${(Math.abs(d.arChange) * 100).toFixed(1)}%${d.arChange >= 0 ? '増えて' : '減って'}います。`,
  )
  overall.push(
    d.overdueCount > 0
      ? `このうち支払期日を過ぎている残高は${yen(d.overdueAmount)}（${d.overdueCount}件）で、売掛金の${pct(d.ar > 0 ? d.overdueAmount / d.ar : null)}を占めます。`
      : '現在、支払期日を過ぎている請求はありません。',
  )
  if (d.collectionRate !== null) overall.push(`期日が到来した請求分の回収率は${pct(d.collectionRate)}です。`)
  sections.push({ title: '全体の状況', lines: overall })

  // 今月の回収予定
  const plan: string[] = []
  const m = monthNo(d.asOf)
  plan.push(
    d.dueThisMonth.count > 0
      ? `${m}月が期日で未回収の請求は${d.dueThisMonth.count}件・${yen(d.dueThisMonth.amount)}です（すでに遅延中のものを含みます）。`
      : `${m}月が期日で未回収の請求はありません。`,
  )
  if (d.dueThisMonth.top.length > 0) {
    plan.push(
      '金額の大きいもの：' +
        d.dueThisMonth.top.map((t) => `${t.client} ${yen(t.amount)}（期日 ${md(t.dueDate)}${t.overdue ? '・遅延中' : ''}）`).join('、'),
    )
  }
  plan.push(
    d.dueNextMonth.count > 0
      ? `来月（${monthNo(d.asOf, 1)}月）が期日の未回収の請求は${d.dueNextMonth.count}件・${yen(d.dueNextMonth.amount)}です。`
      : `来月（${monthNo(d.asOf, 1)}月）が期日の未回収の請求はありません。`,
  )
  sections.push({ title: '今月の回収予定', lines: plan })

  // 回収を急ぐ
  const urgent: string[] = d.urgent.map(
    (u) =>
      `${u.client}：遅延中${u.overdueCount}件・${yen(u.overdueAmount)}（最大${u.maxOverdueDays}日遅れ）${u.partial ? ' ※一部入金のうえ遅延' : ''}`,
  )
  const longOverdue = d.aging.find((a) => a.bucket === '61日超')
  if (longOverdue && longOverdue.amount > 0) {
    urgent.push(
      `61日を超えて滞留している残高が${yen(longOverdue.amount)}（${longOverdue.count}件）あります。長期滞留は回収が難しくなるため、早めの対応が必要です。`,
    )
  }
  if (urgent.length > 0) sections.push({ title: '回収を急ぐ取引先', lines: urgent })

  // 遅れがち
  if (d.habitual.length > 0) {
    sections.push({
      title: '支払いが遅れがちな取引先',
      lines: d.habitual.map((h) => `${h.client}：${h.evaluableCount}件中${h.lateCount}件が遅延、平均${h.avgLateDays}日遅れ`),
    })
  }

  // 次のアクション
  const actions: string[] = []
  if (d.urgent[0]) actions.push(`${d.urgent[0].client}への督促を最優先にしてください（遅延中の残高が最も大きい取引先です）。`)
  const partial = d.urgent.filter((u) => u.partial).map((u) => u.client)
  if (partial.length > 0) actions.push(`${partial.join('、')}は一部入金されています。残額の入金予定日を確認してください。`)
  const soft = d.habitual.filter((h) => h.avgLateDays > 0 && h.avgLateDays <= 14 && h.lateCount >= 3).map((h) => h.client)
  if (soft.length > 0) actions.push(`${soft.join('、')}は数日遅れが続いています。期日の前に事前連絡を入れると効果的です。`)
  if (actions.length === 0) actions.push('現時点で、特に対応が必要な項目はありません。')
  sections.push({ title: '次のアクション', lines: actions })

  return { source: 'rule', sections }
}

/** AIの出力（「## 見出し」で区切られたテキスト）を、表示用のセクションに分ける */
export function parseAiText(text: string): ReportSection[] {
  const sections: ReportSection[] = []
  let cur: ReportSection | null = null
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const h = /^#{1,3}\s*(.+)$/.exec(line)
    if (h) {
      cur = { title: h[1].trim(), lines: [] }
      sections.push(cur)
      continue
    }
    const body = line.replace(/^[-・*•]\s*/, '')
    if (!cur) {
      cur = { title: '今月の注目ポイント', lines: [] }
      sections.push(cur)
    }
    cur.lines.push(body)
  }
  return sections.filter((s) => s.lines.length > 0)
}

export function reportToText(report: Report, asOf: string): string {
  const head = `${asOf.slice(0, 4)}年${Number(asOf.slice(5, 7))}月 売掛金レポート（基準日 ${asOf.replaceAll('-', '/')}）`
  const body = report.sections.map((s) => `■${s.title}\n${s.lines.map((l) => `・${l}`).join('\n')}`).join('\n\n')
  return `${head}\n\n${body}\n`
}

