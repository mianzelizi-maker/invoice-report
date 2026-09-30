import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { candidatesFromInvoices, filterClients, findExact, mergeCandidates, normalizeForSearch, type ClientCandidate } from './clientSearch'
import { parseCsv } from './csv'

const C: ClientCandidate[] = [
  { name: '丸山製作所', kana: 'マルヤマセイサクジョ' },
  { name: '北斗デザイン', kana: 'ホクトデザイン' },
  { name: '東和建設', kana: 'トウワケンセツ' },
  { name: 'サクラ食品', kana: 'サクラショクヒン' },
  { name: 'アルファ物流', kana: 'アルファブツリュウ' },
  { name: 'ネクスト教育', kana: 'ネクストキョウイク' },
  { name: 'Ａｂｃ商事' }, // フリガナなし・全角英字
]
const names = (q: string, list = C) => filterClients(list, q).map((c) => c.name)

describe('表記ゆれの吸収', () => {
  it('ひらがな・カタカナ・半角カナ・全角/半角英数・大小文字・空白を同じに扱う', () => {
    const n = normalizeForSearch('アルファ')
    expect(normalizeForSearch('あるふぁ')).toBe(n)
    expect(normalizeForSearch('ｱﾙﾌｧ')).toBe(n)
    expect(normalizeForSearch('ＡＢＣ')).toBe(normalizeForSearch('abc'))
    expect(normalizeForSearch(' ア ル ファ ')).toBe(n)
  })
})

describe('名前の一部一致', () => {
  it('「物流」でアルファ物流', () => expect(names('物流')).toEqual(['アルファ物流']))
  it('1文字の漢字でも、名前に含まれていれば出す', () => expect(names('物')).toEqual(['アルファ物流']))
  it('ひらがな入力でカタカナの名前に一致（サクラ食品）', () => expect(names('さくら')).toEqual(['サクラ食品']))
  it('半角カナ入力でも一致', () => expect(names('ｱﾙﾌｧ')).toEqual(['アルファ物流']))
  it('全角英字の名前は、半角小文字の入力で一致', () => expect(names('abc')).toEqual(['Ａｂｃ商事']))
  it('一致しなければ空', () => expect(names('存在しない')).toEqual([]))
})

describe('フリガナでの検索', () => {
  it('読みの頭文字（かな1文字）：「と」で東和建設、「さ」でサクラ食品', () => {
    expect(names('と')).toEqual(['東和建設'])
    expect(names('さ')).toEqual(['サクラ食品'])
    expect(names('ホ')).toEqual(['北斗デザイン']) // カタカナでも同じ
  })
  it('かな1文字は「先頭」だけ。名前や読みの途中にある文字（例：ネクスト教育の「ト」）は出さない', () => {
    expect(names('と')).not.toContain('ネクスト教育')
    expect(names('く')).toEqual([]) // 「く」で始まる読みはない（サクラ・ホクト等の途中にはある）
  })
  it('読みの途中でも、2文字以上なら一致（「ぶつりゅう」でアルファ物流）', () => {
    expect(names('ぶつりゅう')).toEqual(['アルファ物流'])
    expect(names('けんせつ')).toEqual(['東和建設'])
  })
  it('読みが長い入力：とうわ → 東和建設', () => expect(names('とうわ')).toEqual(['東和建設']))
  it('先頭が一致するものを、途中一致より上に並べる', () => {
    const list: ClientCandidate[] = [
      { name: '第一ミドリ商店', kana: 'ダイイチミドリショウテン' },
      { name: 'ミドリ薬局', kana: 'ミドリヤッキョク' },
    ]
    expect(names('みどり', list)).toEqual(['ミドリ薬局', '第一ミドリ商店'])
  })
})

describe('候補の並びと合成', () => {
  it('入力が空なら全件を読み順（フリガナ順）に並べる', () => {
    expect(names('')).toEqual(['Ａｂｃ商事', 'アルファ物流', 'サクラ食品', '東和建設', 'ネクスト教育', '北斗デザイン', '丸山製作所'])
  })
  it('同じ名前は1つにまとめ、フリガナは持っているほうを残す', () => {
    const m = mergeCandidates([{ name: 'A社' }], [{ name: 'A社', kana: 'エーシャ' }, { name: 'B社' }])
    expect(m).toEqual([{ name: 'A社', kana: 'エーシャ' }, { name: 'B社' }])
  })
  it('表記ゆれを除いて完全一致する候補を探す', () => {
    expect(findExact(C, ' 東和建設 ')?.kana).toBe('トウワケンセツ')
    expect(findExact(C, 'ａｂｃ商事')?.name).toBe('Ａｂｃ商事')
    expect(findExact(C, '')).toBeUndefined()
  })
})

describe('請求データ（CSV）からの候補', () => {
  it('サンプルCSVのフリガナ列から、10社すべてに読みが付く', () => {
    const invoices = parseCsv(readFileSync('public/sample.csv', 'utf8')).invoices
    const c = candidatesFromInvoices(invoices)
    expect(c).toHaveLength(10)
    expect(c.every((x) => x.kana)).toBe(true)
    expect(names('と', c)).toEqual(['東和建設'])
    expect(names('さ', c)).toEqual(['サクラ食品'])
    expect(names('物流', c)).toEqual(['アルファ物流'])
  })
  it('データがなければ空', () => expect(candidatesFromInvoices(null)).toEqual([]))
})
