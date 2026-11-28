import { fromPcm, toPcm } from '../voice/pcm'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { contextOf, hintsOf } from '../voice/data'
import { missingOf, toDrafts, toHeard, type Lists } from '../voice/drafts'
import { toReport } from '../voice/report'

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

describe('live call audio', () => {
  it('resamples to 16 kHz PCM and reads it back', () => {
    const back = fromPcm(toPcm(new Float32Array(4800).fill(0.5), 48_000))
    expect(back).toHaveLength(1600)
    expect(back[800]).toBeCloseTo(0.5, 3)
  })
})

describe('reports by voice', () => {
  const lists: Lists = {
    projects: [{ id: 'p', name: 'فيلا' }],
    categories: [],
    contractors: [],
    banks: [],
    custodies: [{ id: 'a', name: 'أحمد' }],
  }
  it('matches names, and a dated project report is a period report', () => {
    expect(toReport({ kind: 'project', name: 'فيلا' }, lists).preset).toMatchObject({ type: 'project', id: 'p' })
    expect(
      toReport({ kind: 'project', name: 'فيلا', from: '2026-11-30', to: '2026-11-01' }, lists).preset,
    ).toMatchObject({ type: 'period', from: '2026-11-01', to: '2026-11-30' })
    expect(toReport({ kind: 'custody', name: 'أحمد' }, lists).preset).toMatchObject({ type: 'advance', id: 'a' })
  })
  it('offers nothing for an unknown name or kind', () => {
    expect(toReport({ kind: 'bank', name: 'x' }, lists).preset).toBeNull()
    expect(toReport({ kind: 'salary' }, lists).preset).toBeNull()
  })
})
