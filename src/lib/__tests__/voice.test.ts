import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { contextOf, hintsOf } from '../voice/data'
import { missingOf, toDrafts, toHeard, type Lists } from '../voice/drafts'
import { encodeWav, toBase64 } from '../voice/wav'

const lists: Lists = {
  projects: [{ id: 'p1', name: 'فيلا 50' }],
  categories: [{ id: 'c1', name: 'خامات', expense_items: [{ id: 'i1', name: 'أسمنت' }] }],
  contractors: [{ id: 'k1', name: 'أحمد' }],
  banks: [{ id: 'b1', name: 'CIB' }],
  custodies: [{ id: 'a1', name: 'مهندس علي' }],
}
const heard = {
  type: 'expense',
  project: 'فيلا 50',
  category: 'خامات',
  item: 'أسمنت',
  bank: 'cib',
  amount: 5000,
  date: '2026-11-28',
}

describe('voice drafts', () => {
  it('keeps the app spelling of a heard name and drops unknown ones', () => {
    const [d] = toDrafts([{ ...heard, contractor: 'مقاول جديد' }], lists, [], '2026-11-28')
    expect(d.bank).toBe('CIB')
    expect(d.contractor).toBe('')
    expect(missingOf(d)).toEqual([])
  })

  it('never guesses a missing amount, and defaults a bad date to today', () => {
    const [d] = toDrafts([{ ...heard, amount: 0, date: 'امبارح' }], lists, [], '2026-11-28')
    expect(d.amount).toBe('')
    expect(d.date).toBe('2026-11-28')
    expect(missingOf(d)).toContain('المبلغ')
  })

  it('asks a custody expense for contractor and invoice choices, and no bank', () => {
    const [d] = toDrafts([{ ...heard, type: 'custody_expense', custody: 'مهندس علي', bank: '' }], lists, [], 'x')
    expect(missingOf(d)).toEqual(['المقاول أو «بدون مقاول»', 'الفاتورة أو «بدون فاتورة»'])
    expect(missingOf({ ...d, noContractor: true, noInvoice: true })).toEqual([])
  })

  it('needs only custody, bank and amount for a custody payment', () => {
    const [d] = toDrafts(
      [{ type: 'custody_payment', custody: 'مهندس علي', bank: 'CIB', amount: 100, date: '2026-11-28' }],
      lists,
      [],
      'x',
    )
    expect(missingOf(d)).toEqual([])
  })

  it('keeps the id and photos of a corrected card', () => {
    const [first] = toDrafts([heard], lists, [], 'x')
    const photo = new File(['x'], 'a.jpg')
    const before = [{ ...first, files: [photo] }]
    const [next] = toDrafts([{ ...toHeard(first), amount: 6000 }], lists, before, 'x')
    expect(next.id).toBe(first.id)
    expect(next.files).toEqual([photo])
    expect(next.amount).toBe('6000')
  })
})

describe('voice context', () => {
  it('sends names only', () => {
    expect(JSON.stringify(contextOf({ ...lists, history: [] }))).not.toMatch(/p1|b1|a1|k1|c1|i1/)
  })

  it('keeps the newest hint of each statement', () => {
    const rows = [
      { item: 'أسمنت', category: 'خامات', contractor: { name: 'أحمد' } },
      { item: 'أسمنت', category: 'قديم', contractor: null },
    ]
    expect(hintsOf(rows)).toEqual([{ item: 'أسمنت', category: 'خامات', contractor: 'أحمد' }])
  })
})

describe('wav', () => {
  it('writes a PCM header and clamps loud samples', () => {
    const bytes = encodeWav(new Float32Array([0, 2, -2]), 16000)
    const view = new DataView(bytes.buffer)
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF')
    expect(view.getUint32(24, true)).toBe(16000)
    expect(view.getInt16(46, true)).toBe(32767)
    expect(view.getInt16(48, true)).toBe(-32768)
    expect(atob(toBase64(bytes)).length).toBe(50)
  })
})
