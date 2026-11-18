import { describe, expect, it } from 'vitest'
import { distinct, filterExpenses, isExpenseFiltering, NO_EXPENSE_FILTER } from '../advances/advanceFilter'
import type { Entry } from '../entries/entryTypes'

const e = (o: Partial<Entry> & { id: string }) =>
  ({
    seq: 1,
    category: 'مواد',
    item: 'سيراميك',
    notes: null,
    amount: 100,
    entry_date: '2026-11-10',
    project: { name: 'العيادة' },
    contractor: null,
    ...o,
  }) as unknown as Entry

const rows = [
  e({ id: 'a', seq: 11, amount: 350, item: 'نقل فرم' }),
  e({
    id: 'b',
    seq: 12,
    amount: 4000,
    category: 'عمالة',
    project: { name: 'شاليا' } as never,
    entry_date: '2026-11-15',
  }),
  e({ id: 'c', seq: 13, amount: 600, notes: 'ردش', entry_date: '2026-11-01' }),
]

describe('filterExpenses', () => {
  it('keeps everything with an empty filter', () => {
    expect(filterExpenses(rows, NO_EXPENSE_FILTER)).toHaveLength(3)
    expect(isExpenseFiltering(NO_EXPENSE_FILTER)).toBe(false)
  })
  it('matches text in item, notes, amount and number', () => {
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, text: 'فرم' }).map((r) => r.id)).toEqual(['a'])
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, text: 'ردش' }).map((r) => r.id)).toEqual(['c'])
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, text: '4000' }).map((r) => r.id)).toEqual(['b'])
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, text: '13' }).map((r) => r.id)).toEqual(['c'])
  })
  it('filters by project, category and date range together', () => {
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, project: 'شاليا' }).map((r) => r.id)).toEqual(['b'])
    expect(filterExpenses(rows, { ...NO_EXPENSE_FILTER, category: 'عمالة' }).map((r) => r.id)).toEqual(['b'])
    expect(
      filterExpenses(rows, { ...NO_EXPENSE_FILTER, from: '2026-11-05', to: '2026-11-12' }).map((r) => r.id),
    ).toEqual(['a'])
    expect(
      filterExpenses(rows, { ...NO_EXPENSE_FILTER, project: 'العيادة', from: '2026-11-05' }).map((r) => r.id),
    ).toEqual(['a'])
  })
})

describe('distinct', () => {
  it('drops empties and repeats', () => {
    expect(distinct(['ب', 'أ', null, 'ب', ''])).toEqual(['أ', 'ب'])
  })
})
