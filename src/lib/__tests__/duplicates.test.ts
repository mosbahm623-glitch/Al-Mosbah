import { describe, expect, it } from 'vitest'
import { extraAmount, isConsecutivePair, summarizeDuplicates, type DuplicateGroup } from '../duplicates'

const group = (over: Partial<DuplicateGroup>): DuplicateGroup => ({
  entry_date: '2026-11-11',
  kind: 'expense',
  amount: 755,
  category: 'نقاشة',
  item: 'فاتورة خامات',
  project: 'ديستركت',
  n: 2,
  entries: [
    { seq: 20264959, status: 'approved' },
    { seq: 20264960, status: 'approved' },
  ],
  ...over,
})

describe('duplicates', () => {
  it('counts only the entries beyond the first as extra money', () => {
    expect(extraAmount(group({ n: 2, amount: 755 }))).toBe(755)
    expect(extraAmount(group({ n: 4, amount: 100 }))).toBe(300)
  })
  it('spots two entries typed one right after the other', () => {
    expect(isConsecutivePair(group({}))).toBe(true)
    expect(
      isConsecutivePair(
        group({
          entries: [
            { seq: 1, status: 'approved' },
            { seq: 900, status: 'approved' },
          ],
        }),
      ),
    ).toBe(false)
    expect(
      isConsecutivePair(
        group({
          n: 3,
          entries: [
            { seq: 1, status: 'approved' },
            { seq: 2, status: 'approved' },
            { seq: 3, status: 'approved' },
          ],
        }),
      ),
    ).toBe(false)
  })
  it('summarizes groups, extra entries and extra money per kind', () => {
    const s = summarizeDuplicates([
      group({}),
      group({ kind: 'income', amount: 500000, n: 2 }),
      group({
        n: 3,
        amount: 100,
        entries: [
          { seq: 1, status: 'approved' },
          { seq: 2, status: 'approved' },
          { seq: 3, status: 'approved' },
        ],
      }),
    ])
    expect(s).toEqual({ groups: 3, extraEntries: 4, extraIncome: 500000, extraExpense: 955, consecutive: 2 })
  })
})
