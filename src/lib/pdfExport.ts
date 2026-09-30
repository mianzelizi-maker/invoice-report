import type { InvoiceDraft } from './invoiceCalc'

let fontsRegistered = false

/** 日本語フォント（Noto Sans JP・SIL OFL）を登録する。ファイルは public/fonts にある */
export function registerFonts(
  Font: Pick<typeof import('@react-pdf/renderer').Font, 'register' | 'registerHyphenationCallback'>,
  base: string,
) {
  if (fontsRegistered) return
  Font.register({
    family: 'NotoSansJP',
    fonts: [
      { src: `${base}NotoSansJP-Regular.otf`, fontWeight: 400 },
      { src: `${base}NotoSansJP-Bold.otf`, fontWeight: 700 },
    ],
  })
  // 日本語は語の途中で勝手にハイフン分割しない
  Font.registerHyphenationCallback((w) => [w])
  fontsRegistered = true
}

/**
 * 請求書PDFを作る。重いライブラリとフォントは、ここで初めて読み込む（ボタンを押したときだけ）。
 */
export async function buildInvoicePdf(draft: InvoiceDraft): Promise<Blob> {
  const [{ pdf, Font }, { InvoiceDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('../components/InvoicePdf'),
  ])
  registerFonts(Font, `${window.location.origin}${import.meta.env.BASE_URL}fonts/`)
  return pdf(InvoiceDocument({ draft })).toBlob()
}

/** ファイル名に使えない文字を除く */
export const pdfFileName = (draft: InvoiceDraft) =>
  `請求書_${draft.invoiceNo}_${draft.client}`.replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80) + '.pdf'

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
