/** 1回の入金（分割入金の履歴の1行） */
export type Payment = { date: string; amount: number }

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
  payments?: Payment[] // 入金の履歴（任意）。ない場合は paidDate・paidAmount の1回分として扱う
}

export type PaymentStatus = '入金済み' | '一部入金' | '未入金'
/** 画面に出す状態。残高があり期日を過ぎていれば「支払遅延」を優先する */
export type DisplayStatus = PaymentStatus | '支払遅延'
