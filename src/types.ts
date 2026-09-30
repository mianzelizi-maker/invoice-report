export type Row = {
  month: string // YYYY-MM
  client: string
  media: string
  adSpend: number
  inquiries: number
  conversions: number
  monthlyFee: number
  outsourcingCost: number
}

export type Totals = {
  adSpend: number
  inquiries: number
  conversions: number
  monthlyFee: number
  outsourcingCost: number
  grossProfit: number
  grossMargin: number | null // 報酬0のときnull
  cpa: number | null // CV0のときnull
}

export type Group = { key: string; totals: Totals }
