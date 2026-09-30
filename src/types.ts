/** 請求書1件。日付は YYYY-MM-DD、金額は税込の円 */
export type Invoice = {
  client: string
  clientKana?: string // 取引先のフリガナ（任意。宛先の検索に使う）
  invoiceNo: string
  issueDate: string
  amount: number
  dueDate: string
  paidDate: string | null
  paidAmount: number
}

export type PaymentStatus = '入金済み' | '一部入金' | '未入金'
/** 画面に出す状態。残高があり期日を過ぎていれば「支払遅延」を優先する */
export type DisplayStatus = PaymentStatus | '支払遅延'
