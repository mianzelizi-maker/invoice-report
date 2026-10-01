import type { Invoice } from '../types'
import { dateLabel, yen } from './format'
import { overdueDays } from './status'
import { receivable } from './aggregate'

export type ReminderStage = '初回' | '再度' | '最終'

export type Reminder = {
  stage: ReminderStage
  subject: string
  body: string
  invoices: Invoice[] // 文面に載せた遅延中の請求書（期日の早い順）
  total: number
}

/** 最も遅れている請求書の遅延日数で文面の強さを決める（30日まで初回、60日まで再度、それ以上は最終） */
export function reminderStage(maxDays: number): ReminderStage {
  if (maxDays <= 30) return '初回'
  if (maxDays <= 60) return '再度'
  return '最終'
}

const SUBJECT: Record<ReminderStage, string> = {
  初回: 'お支払いのご確認について',
  再度: 'お支払いのお願い（再度のご連絡）',
  最終: 'お支払いのお願い（最終のご連絡）',
}

const OPENING: Record<ReminderStage, string> = {
  初回: '平素より大変お世話になっております。\n下記のご請求について、お支払期日を過ぎておりますが、当方にて入金を確認できておりません。\n行き違いでご入金済みの場合は、何卒ご容赦ください。',
  再度: '平素より大変お世話になっております。\n先日もご連絡いたしましたが、下記のご請求について、いまだ入金を確認できておりません。\nお忙しいところ恐れ入りますが、あらためてご確認をお願いいたします。',
  最終: '平素より大変お世話になっております。\n下記のご請求について、再三のご連絡にもかかわらず、入金を確認できておりません。\n誠に恐縮ですが、お支払いの予定日をお知らせいただけますよう、お願い申し上げます。',
}

const CLOSING: Record<ReminderStage, string> = {
  初回: 'ご不明な点がございましたら、お気軽にご連絡ください。\n何卒よろしくお願い申し上げます。',
  再度: '今月中のお支払いをお願いできれば幸いです。\nご事情がおありの場合は、お知らせください。',
  最終: '本書面と行き違いでお支払いいただいている場合は、ご容赦ください。\n早急なご対応を、重ねてお願い申し上げます。',
}

/** 指定した取引先の遅延中の請求書から、督促メールの下書きを作る。遅延中の請求書がなければ null */
export function buildReminder(client: string, invoices: Invoice[], asOf: string, sender = '（自社名・担当者名）'): Reminder | null {
  const overdue = invoices
    .filter((i) => i.client === client && overdueDays(i, asOf) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.invoiceNo.localeCompare(b.invoiceNo))
  if (overdue.length === 0) return null

  const stage = reminderStage(Math.max(...overdue.map((i) => overdueDays(i, asOf))))
  const total = overdue.reduce((sum, i) => sum + receivable(i), 0)
  const lines = overdue.map((i) => {
    const paid = i.paidAmount > 0 ? `（ご請求額 ${yen(i.amount)}、うち ${yen(i.paidAmount)} は入金済み）` : ''
    return `・請求書番号 ${i.invoiceNo} ／ 期日 ${dateLabel(i.dueDate)} ／ 未入金額 ${yen(receivable(i))}${paid}`
  })

  const body = [
    `${client} 御中`,
    '',
    OPENING[stage],
    '',
    ...lines,
    ...(overdue.length > 1 ? ['', `未入金額の合計：${yen(total)}`] : []),
    '',
    CLOSING[stage],
    '',
    sender,
  ].join('\n')

  return { stage, subject: SUBJECT[stage], body, invoices: overdue, total }
}
