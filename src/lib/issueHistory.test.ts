import { describe, expect, it } from 'vitest'
import { addIssued, emptyHistory, loadHistory } from './issueHistory'

describe('発行の履歴', () => {
  it('発行した宛先が新しい順に入り、同じ名前は1つにまとまる', () => {
    let h = addIssued(emptyHistory(), { name: 'A社', kana: 'エーシャ' }, 'INV-202609-001')
    h = addIssued(h, { name: 'B社' }, 'INV-202609-002')
    h = addIssued(h, { name: 'A社' }, 'INV-202609-003') // 2回目はフリガナなしで発行しても、前のフリガナを残す
    expect(h.clients).toEqual([{ name: 'A社', kana: 'エーシャ' }, { name: 'B社' }])
    expect(h.nos).toEqual(['INV-202609-001', 'INV-202609-002', 'INV-202609-003'])
  })
  it('宛先は30件、請求番号は200件まで', () => {
    let h = emptyHistory()
    for (let i = 0; i < 250; i++) h = addIssued(h, { name: `社${i}` }, `INV-202609-${i}`)
    expect(h.clients).toHaveLength(30)
    expect(h.clients[0].name).toBe('社249')
    expect(h.nos).toHaveLength(200)
  })
  it('保存領域が使えない・壊れている環境でも、空の履歴で動く', () => {
    expect(loadHistory()).toEqual(emptyHistory())
  })
})
