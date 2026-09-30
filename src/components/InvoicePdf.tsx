import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { calcInvoice, type InvoiceDraft, type TaxRate } from '../lib/invoiceCalc'
import { yen } from '../lib/format'

// PDFの中身（@react-pdf/renderer）。このファイルはPDFを作るときだけ読み込まれる（初期表示を重くしない）

const NAVY = '#1c2a4a'
const styles = StyleSheet.create({
  page: { fontFamily: 'NotoSansJP', fontSize: 9.5, color: '#1d2433', padding: 40, paddingBottom: 56 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 2, borderBottomColor: NAVY, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: 700, color: NAVY, letterSpacing: 6 },
  meta: { textAlign: 'right', lineHeight: 1.5 },
  two: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18 },
  left: { width: '54%' },
  right: { width: '42%', lineHeight: 1.35 },
  client: { fontSize: 14, fontWeight: 700, borderBottomWidth: 1, borderBottomColor: '#1d2433', paddingBottom: 3 },
  lead: { marginTop: 10, color: '#4a5263' },
  amountBox: { marginTop: 12, borderWidth: 1, borderColor: NAVY, padding: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountLabel: { fontSize: 10 },
  amount: { fontSize: 18, fontWeight: 700, color: NAVY },
  issuerName: { fontSize: 11, fontWeight: 700 },
  small: { fontSize: 8.5, color: '#4a5263' },
  table: { marginTop: 20 },
  th: { flexDirection: 'row', backgroundColor: NAVY, color: '#ffffff', paddingVertical: 5, paddingHorizontal: 6, fontWeight: 700 },
  tr: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: '#c9c3b4' },
  cName: { flex: 1 },
  cQty: { width: 44, textAlign: 'right' },
  cUnit: { width: 70, textAlign: 'right' },
  cRate: { width: 44, textAlign: 'right' },
  cAmt: { width: 78, textAlign: 'right' },
  sum: { marginTop: 12, width: '55%', alignSelf: 'flex-end' },
  sumRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5, paddingHorizontal: 6 },
  sumTotal: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, paddingHorizontal: 6, marginTop: 4, backgroundColor: '#efe9d9', fontWeight: 700, fontSize: 11 },
  section: { marginTop: 16 },
  sectionTitle: { fontWeight: 700, color: NAVY, marginBottom: 3 },
  box: { borderWidth: 0.5, borderColor: '#c9c3b4', padding: 7, lineHeight: 1.3 },
  footer: { position: 'absolute', bottom: 24, left: 40, right: 40, textAlign: 'center', fontSize: 8, color: '#8a8f9c' },
})

const rateLabel = (r: TaxRate) => (r === 8 ? '8%※' : r === 10 ? '10%' : '非課税')
const groupLabel = (r: TaxRate) => (r === 0 ? '非課税対象' : `${r}%対象${r === 8 ? '※' : ''}`)

/** 2026-09-30 → 2026年9月30日 */
export const jpDate = (d: string) => `${d.slice(0, 4)}年${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`

export function InvoiceDocument({ draft }: { draft: InvoiceDraft }) {
  const t = calcInvoice(draft.lines)
  const { issuer } = draft
  const hasReduced = t.groups.some((g) => g.rate === 8)

  return (
    <Document title={`請求書 ${draft.invoiceNo}`} author={issuer.name} language="ja">
      <Page size="A4" style={styles.page}>
        <View style={styles.head}>
          <Text style={styles.title}>請求書</Text>
          <View style={styles.meta}>
            <Text>請求番号　{draft.invoiceNo}</Text>
            <Text>発行日　{jpDate(draft.issueDate)}</Text>
          </View>
        </View>

        <View style={styles.two}>
          <View style={styles.left}>
            <Text style={styles.client}>{draft.client}　御中</Text>
            <Text style={styles.lead}>下記のとおりご請求申し上げます。</Text>
            <View style={styles.amountBox}>
              <Text style={styles.amountLabel}>ご請求金額（税込）</Text>
              <Text style={styles.amount}>{yen(t.total)}</Text>
            </View>
            <Text style={{ marginTop: 6 }}>お支払期日　<Text style={{ fontWeight: 700 }}>{jpDate(draft.dueDate)}</Text></Text>
          </View>
          <View style={styles.right}>
            <Text style={styles.issuerName}>{issuer.name}</Text>
            {issuer.address ? <Text>{issuer.address}</Text> : null}
            {issuer.tel ? <Text>TEL {issuer.tel}</Text> : null}
            {issuer.registrationNo ? <Text>登録番号 {issuer.registrationNo}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.th}>
            <Text style={styles.cName}>品目</Text>
            <Text style={styles.cQty}>数量</Text>
            <Text style={styles.cUnit}>単価</Text>
            <Text style={styles.cRate}>税率</Text>
            <Text style={styles.cAmt}>金額</Text>
          </View>
          {t.lines.map((l, i) => (
            <View key={i} style={styles.tr} wrap={false}>
              <Text style={styles.cName}>{l.name}</Text>
              <Text style={styles.cQty}>{l.qty}</Text>
              <Text style={styles.cUnit}>{yen(l.unitPrice)}</Text>
              <Text style={styles.cRate}>{rateLabel(l.taxRate)}</Text>
              <Text style={styles.cAmt}>{yen(l.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sum} wrap={false}>
          {t.groups.map((g) => (
            <View key={g.rate}>
              <View style={styles.sumRow}>
                <Text>{groupLabel(g.rate)}　小計</Text>
                <Text>{yen(g.subtotal)}</Text>
              </View>
              {g.rate !== 0 && (
                <View style={styles.sumRow}>
                  <Text>消費税（{g.rate}%）</Text>
                  <Text>{yen(g.tax)}</Text>
                </View>
              )}
            </View>
          ))}
          <View style={styles.sumRow}>
            <Text>小計（税抜）</Text>
            <Text>{yen(t.subtotal)}</Text>
          </View>
          <View style={styles.sumRow}>
            <Text>消費税 合計</Text>
            <Text>{yen(t.tax)}</Text>
          </View>
          <View style={styles.sumTotal}>
            <Text>合計（税込）</Text>
            <Text>{yen(t.total)}</Text>
          </View>
        </View>
        {hasReduced && <Text style={[styles.small, { marginTop: 6, textAlign: 'right' }]}>※は軽減税率（8%）対象です。</Text>}

        {issuer.bank ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>お振込先</Text>
            <View style={styles.box}>{issuer.bank.split('\n').map((line, i) => <Text key={i}>{line}</Text>)}</View>
          </View>
        ) : null}

        {draft.note ? (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>備考</Text>
            <View style={styles.box}>{draft.note.split('\n').map((line, i) => <Text key={i}>{line}</Text>)}</View>
          </View>
        ) : null}

        <Text style={styles.footer} fixed render={({ pageNumber, totalPages }) => `${draft.invoiceNo}　${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  )
}
