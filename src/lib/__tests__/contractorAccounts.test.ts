import { describe, expect, it } from 'vitest'
import { buildAccounts } from '../contractors/accounts'
import type { LedgerTxn, Spent } from '../contractors/contractors'

const txn = (id: string, project: string, kind: 'due' | 'payment', amount: number, date: string): LedgerTxn => ({
  id,
  project_id: project,
  kind,
  amount,
  txn_date: date,
  notes: null,
  project: { name: project },
  items: [],
})
const entry = (id: string, project: string, amount: number, date: string): Spent => ({
  id,
  seq: 1,
  project_id: project,
  category: 'دهانات',
  item: null,
  amount,
  entry_date: date,
  project: { name: project, status: 'active' },
})

describe('contractor accounts per project', () => {
  it('counts expense entries as payments and keeps each project apart', () => {
    const accounts = buildAccounts(
      [txn('d1', 'A', 'due', 57000, '2026-11-20'), txn('d2', 'B', 'due', 30000, '2026-11-10')],
      [
        entry('e1', 'A', 10000, '2026-10-03'),
        entry('e2', 'A', 35000, '2026-11-02'),
        entry('e3', 'B', 30000, '2026-11-15'),
      ],
    )
    const a = accounts.find((x) => x.key === 'A')!
    const b = accounts.find((x) => x.key === 'B')!
    expect([a.due, a.paid, a.left]).toEqual([57000, 45000, 12000])
    expect([b.due, b.paid, b.left]).toEqual([30000, 30000, 0])
    expect(a.lines.map((l) => l.run)).toEqual([-10000, -45000, 12000])
  })
  it('a project with payments but no due shows what was paid and owes nothing', () => {
    const [only] = buildAccounts([], [entry('e1', 'C', 5000, '2026-11-01')])
    expect(only).toMatchObject({ hasDue: false, paid: 5000, left: 0 })
    expect(only.lines[0].run).toBeNull()
  })
})
