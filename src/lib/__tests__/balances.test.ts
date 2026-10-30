import { describe, expect, it } from 'vitest'
import { allows } from '../../auth/permissions'
import { advanceBalance } from '../advances'
import { bankBalance, byProject, type BankMovement } from '../banks'
import { dateText, money } from '../format'

const move = (over: Partial<BankMovement>): BankMovement => ({
  id: '1',
  seq: 1,
  kind: 'expense',
  entry_date: '2026-10-01',
  category: 'c',
  item: null,
  notes: null,
  amount: 100,
  project_id: 'p1',
  project_name: 'فيلا',
  contractor: null,
  ...over,
})

describe('advanceBalance', () => {
  it('is received − spent − returned', () => {
    expect(advanceBalance({ given: 25000, spent: 15000, returned: 0 })).toBe(10000)
    expect(advanceBalance({ given: 25000, spent: 15000, returned: 4000 })).toBe(6000)
  })
  it('goes negative when more was spent than received', () => {
    expect(advanceBalance({ given: 1000, spent: 1500, returned: 0 })).toBe(-500)
  })
})

describe('bank balance and per-project totals', () => {
  it('adds the opening balance to income and subtracts expenses', () => {
    expect(bankBalance({ opening_balance: 100000, income: 80000, expenses: 30000 })).toBe(150000)
  })
  it('groups movements by project and sorts by name', () => {
    const rows = [
      move({ id: '1', kind: 'income', amount: 500, project_id: 'b', project_name: 'ب' }),
      move({ id: '2', kind: 'expense', amount: 200, project_id: 'b', project_name: 'ب' }),
      move({ id: '3', kind: 'expense', amount: 50, project_id: 'a', project_name: 'أ' }),
    ]
    expect(byProject(rows)).toEqual([
      { id: 'a', name: 'أ', income: 0, expenses: 50 },
      { id: 'b', name: 'ب', income: 500, expenses: 200 },
    ])
  })
})

describe('permissions', () => {
  it('admins can do everything', () => {
    expect(allows(true, {}, 'banks', 'edit')).toBe(true)
  })
  it('no row means no access', () => {
    expect(allows(false, {}, 'projects')).toBe(false)
  })
  it('view allows reading only; edit allows both', () => {
    expect(allows(false, { projects: 'view' }, 'projects')).toBe(true)
    expect(allows(false, { projects: 'view' }, 'projects', 'edit')).toBe(false)
    expect(allows(false, { projects: 'edit' }, 'projects')).toBe(true)
    expect(allows(false, { projects: 'edit' }, 'projects', 'edit')).toBe(true)
  })
  it('one page does not grant another', () => {
    expect(allows(false, { advances: 'edit' }, 'projects')).toBe(false)
  })
})

describe('format', () => {
  it('prints dates day-first', () => {
    expect(dateText('2026-10-27')).toBe('27-10-2026')
  })
  it('groups thousands with latin digits', () => {
    expect(money(1234567.5)).toMatch(/1.234.567[.,]5/)
  })
})
