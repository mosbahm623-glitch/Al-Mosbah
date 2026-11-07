import { describe, expect, it } from 'vitest'
import {
  NO_ENTRY_FILTER,
  buildMoves,
  choicesOf,
  enteredByOf,
  filterAdvanceEntries,
  filterMoves,
  isEntryFiltering,
  totalsOfMoves,
} from '../advanceEntryFilter'
import type { AdvanceReturn, Installment } from '../advances'
import type { Entry } from '../projects'

const e = (over: Partial<Entry>): Entry =>
  ({
    id: '1',
    seq: 1,
    kind: 'expense',
    category: 'بلاط',
    item: 'سيراميك',
    amount: 100,
    entry_date: '2026-10-10',
    notes: null,
    status: 'approved',
    contractor: null,
    project: { name: 'فيلا 5' },
    creator: null,
    entered_by_name: null,
    ...over,
  }) as Entry

const rows = [
  e({ id: 'a', seq: 1, entered_by_name: 'ibrahim' }),
  e({ id: 'b', seq: 2, category: 'نقاشة', item: 'دهان', entry_date: '2026-10-20', creator: { full_name: 'محمود' } }),
  e({
    id: 'c',
    seq: 3,
    project: { name: 'شقة 2' },
    contractor: { name: 'سلم' },
    notes: 'فاتورة ناقصة',
    entry_date: '2026-11-02',
  }),
]

describe('filterAdvanceEntries', () => {
  it('keeps everything when nothing is filled in', () => {
    expect(filterAdvanceEntries(rows, NO_ENTRY_FILTER)).toHaveLength(3)
    expect(isEntryFiltering(NO_ENTRY_FILTER)).toBe(false)
  })
  it('filters by project, category, contractor and entrant', () => {
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, project: 'شقة 2' }).map((x) => x.id)).toEqual(['c'])
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, category: 'نقاشة' }).map((x) => x.id)).toEqual(['b'])
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, contractor: 'سلم' }).map((x) => x.id)).toEqual(['c'])
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, who: 'ibrahim' }).map((x) => x.id)).toEqual(['a'])
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, who: 'محمود' }).map((x) => x.id)).toEqual(['b'])
  })
  it('searches the description and the notes, and bounds the dates inclusively', () => {
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, text: 'دهان' }).map((x) => x.id)).toEqual(['b'])
    expect(filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, text: 'ناقصة' }).map((x) => x.id)).toEqual(['c'])
    expect(
      filterAdvanceEntries(rows, { ...NO_ENTRY_FILTER, from: '2026-10-20', to: '2026-11-02' }).map((x) => x.id),
    ).toEqual(['b', 'c'])
  })
  it('names the entrant from the profile first, then the copied name', () => {
    expect(enteredByOf(rows[0])).toBe('ibrahim')
    expect(enteredByOf(rows[1])).toBe('محمود')
    expect(enteredByOf(rows[2])).toBeNull()
  })
  it('lists each choice once', () => {
    expect(choicesOf(rows, (x) => x.category)).toEqual(['بلاط', 'نقاشة'])
  })
})

describe('movements of a custody', () => {
  const ins: Installment[] = [
    { id: 'p1', amount: 1000, paid_on: '2026-10-15', status: 'approved', reject_reason: null },
    { id: 'p2', amount: 500, paid_on: '2026-10-25', status: 'pending', reject_reason: null },
  ]
  const back: AdvanceReturn[] = [{ id: 'r1', amount: 50, returned_on: '2026-11-05', notes: 'باقي' }]
  const moves = buildMoves(ins, rows, back)

  it('puts everything in one list, newest first', () => {
    expect(moves).toHaveLength(6)
    expect(moves[0].key).toBe('r-r1')
    expect(moves.at(-1)?.key).toBe('e-a')
  })
  it('narrows by kind and by dates for every kind', () => {
    expect(filterMoves(moves, 'in', NO_ENTRY_FILTER)).toHaveLength(2)
    expect(filterMoves(moves, 'back', NO_ENTRY_FILTER)).toHaveLength(1)
    const range = { ...NO_ENTRY_FILTER, from: '2026-10-20', to: '2026-10-31' }
    expect(filterMoves(moves, 'all', range).map((m) => m.key)).toEqual(['i-p2', 'e-b'])
  })
  it('hides payments and returns while a project, category, contractor or entrant is chosen', () => {
    const got = filterMoves(moves, 'all', { ...NO_ENTRY_FILTER, project: 'فيلا 5' })
    expect(got.every((m) => m.type === 'out')).toBe(true)
    expect(got).toHaveLength(2)
  })
  it('counts only approved payments and expenses, but every return', () => {
    expect(totalsOfMoves(moves)).toEqual({ in: 1000, out: 300, back: 50 })
  })
})
