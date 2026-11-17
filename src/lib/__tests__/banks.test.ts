import { describe, expect, it } from 'vitest'
import { bankBalance, byProject, dashboardBanks, movementSign, type BankMovement, type BankSummary } from '../banks'

const bank = (name: string, opening: number, income: number, expenses: number): BankSummary => ({
  id: name,
  name,
  logo: null,
  opening_balance: opening,
  income,
  expenses,
  transfers_in: 0,
  transfers_out: 0,
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

describe('bank transfers', () => {
  it('adds transfers in and subtracts transfers out of the balance', () => {
    const b = { ...bank('CIB', 1000, 500, 200), transfers_in: 300, transfers_out: 800 }
    expect(bankBalance(b)).toBe(800)
  })
  it('signs a movement by direction', () => {
    expect(movementSign({ kind: 'income' })).toBe(1)
    expect(movementSign({ kind: 'transfer_in' })).toBe(1)
    expect(movementSign({ kind: 'expense' })).toBe(-1)
    expect(movementSign({ kind: 'transfer_out' })).toBe(-1)
  })
  it('keeps transfers out of the per-project table', () => {
    const m = (kind: BankMovement['kind'], project_id: string | null): BankMovement => ({
      id: kind,
      seq: null,
      kind,
      entry_date: '2026-11-17',
      category: '',
      item: null,
      notes: null,
      amount: 100,
      project_id,
      project_name: project_id ?? 'تحويل',
      contractor: null,
    })
    expect(byProject([m('income', 'p1'), m('transfer_out', null)])).toEqual([
      { id: 'p1', name: 'p1', income: 100, expenses: 0 },
    ])
  })
})
