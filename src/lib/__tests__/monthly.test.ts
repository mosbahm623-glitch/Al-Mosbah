import { describe, expect, it } from 'vitest'
import { lastMonths, monthlyTotals } from '../monthly'

describe('lastMonths', () => {
  it('counts back across a year change, oldest first', () => {
    expect(lastMonths('2026-02-15', 4)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })
  it('ends at the current month', () => {
    expect(lastMonths('2026-10-30', 1)).toEqual(['2026-10'])
  })
})

describe('monthlyTotals', () => {
  const lines = [
    { kind: 'income' as const, amount: 0.1, entry_date: '2026-10-01' },
    { kind: 'income' as const, amount: 0.2, entry_date: '2026-10-30' },
    { kind: 'expense' as const, amount: 40, entry_date: '2026-10-15' },
    { kind: 'expense' as const, amount: 7, entry_date: '2026-08-02' },
  ]
  it('sums income and expenses per month exactly to the cent', () => {
    const rows = monthlyTotals(lines, ['2026-08', '2026-09', '2026-10'])
    expect(rows[2]).toEqual({ month: '2026-10', income: 0.3, expenses: 40 })
    expect(rows[0]).toEqual({ month: '2026-08', income: 0, expenses: 7 })
  })
  it('keeps months with no movement as zero rows', () => {
    expect(monthlyTotals(lines, ['2026-09'])).toEqual([{ month: '2026-09', income: 0, expenses: 0 }])
  })
})
