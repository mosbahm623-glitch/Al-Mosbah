import { describe, expect, it } from 'vitest'
import { dashboardBanks, type BankSummary } from '../banks'

const bank = (name: string, opening: number, income: number, expenses: number): BankSummary => ({
  id: name,
  name,
  logo: null,
  opening_balance: opening,
  income,
  expenses,
})

describe('dashboardBanks', () => {
  it('leaves out «أخرى», sorts by balance and totals the rest', () => {
    const r = dashboardBanks([
      bank('CIB', -155456.95, 10177081, 10020513),
      bank('أخرى', 469200, 439000, 908200),
      bank('Al Ahly', -157882.82, 1705000, 1439910),
      bank('Cash', 252667, 2304315, 2556982),
    ])
    expect(r.banks.map((b) => b.name)).toEqual(['Al Ahly', 'CIB', 'Cash'])
    expect(Math.round(r.total * 100) / 100).toBe(108318.23)
    expect(r.banks[0]).toMatchObject({ name: 'Al Ahly', logo: null })
  })
  it('is empty when there is no bank', () => {
    expect(dashboardBanks([])).toEqual({ banks: [], total: 0 })
  })
})
