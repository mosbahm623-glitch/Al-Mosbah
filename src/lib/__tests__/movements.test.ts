import { describe, expect, it } from 'vitest'
import { direction, shiftDay, sortMovements, totalsOfDay, type Movement } from '../movements'

const m = (over: Partial<Movement>): Movement => ({
  key: 'k',
  kind: 'expense',
  date: '2026-10-28',
  at: '2026-10-28T10:00:00Z',
  amount: 100,
  category: null,
  title: 't',
  project: null,
  party: null,
  detail: null,
  notes: null,
  seq: null,
  fromAdvance: false,
  status: 'approved',
  ...over,
})

describe('totalsOfDay', () => {
  it('sums each kind separately', () => {
    const t = totalsOfDay([
      m({ kind: 'income', amount: 1000 }),
      m({ kind: 'expense', amount: 250.5 }),
      m({ kind: 'installment', amount: 300 }),
      m({ kind: 'payment', amount: 80 }),
      m({ kind: 'due', amount: 120 }),
      m({ kind: 'return', amount: 20 }),
    ])
    expect(t).toMatchObject({
      income: 1000,
      expense: 250.5,
      installment: 300,
      payment: 80,
      due: 120,
      return: 20,
      count: 6,
    })
  })
  it('keeps expenses paid from a custody out of the cash expense', () => {
    const t = totalsOfDay([m({ amount: 100 }), m({ amount: 40, fromAdvance: true })])
    expect(t.expense).toBe(140)
    expect(t.cashExpense).toBe(100)
  })
  it('has no floating point noise', () => {
    expect(totalsOfDay([m({ kind: 'income', amount: 0.1 }), m({ kind: 'income', amount: 0.2 })]).income).toBe(0.3)
  })
})

describe('direction', () => {
  it('marks income and returns as in, cash out as out, custody-paid expenses as neutral', () => {
    expect(direction(m({ kind: 'income' }))).toBe('in')
    expect(direction(m({ kind: 'return' }))).toBe('in')
    expect(direction(m({ kind: 'expense' }))).toBe('out')
    expect(direction(m({ kind: 'expense', fromAdvance: true }))).toBe('neutral')
    expect(direction(m({ kind: 'installment' }))).toBe('out')
    expect(direction(m({ kind: 'due' }))).toBe('neutral')
  })
})

describe('sortMovements', () => {
  it('puts the most recently recorded first', () => {
    const rows = [m({ key: 'a', at: '2026-10-28T08:00:00Z' }), m({ key: 'b', at: '2026-10-28T09:00:00Z' })]
    expect(sortMovements(rows).map((r) => r.key)).toEqual(['b', 'a'])
  })
})

describe('shiftDay', () => {
  it('moves across month and year ends', () => {
    expect(shiftDay('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })
})
