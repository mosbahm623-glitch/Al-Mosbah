import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query, type Recorded } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../supabase'
import {
  addInstallment,
  createAdvance,
  deleteAdvanceMoney,
  saveAdvanceMoney,
  setAdvanceStatus,
  updateAdvance,
} from '../advances'
import { saveBank } from '../banks'
import { addExpenseItem, createBank, createCategory, createContractor, fetchCategories } from '../catalog'
import { fetchAllContractorTxns, fetchContractorLedger } from '../contractors'
import {
  deleteEntry,
  fetchApprovedExpenses,
  fetchDecidedOn,
  fetchEntriesByStatus,
  fetchEntryHistory,
  fetchMyEntries,
  insertEntry,
  updateEntry,
  type EntryInput,
} from '../entries'
import { fetchDashboardSummary, saveProject } from '../projects'
import { replaceAdvanceAccess, replacePermissions, updateRole } from '../users'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

/** Every `from(table)` call returns the next planned result for that table; the calls made on it are recorded. */
let used: Recorded[]
const plan = (byTable: Record<string, unknown[]>) => {
  used = []
  from.mockImplementation(((table: string) => {
    const q = query(byTable[table]?.shift() ?? { data: [], error: null })
    used.push({ table, calls: q.calls })
    return q.query
  }) as never)
}
const callsOn = (i = 0) => used[i].calls
const ok = (data: unknown) => ({ data, error: null })
const fail = { data: null, error: new Error('x') }

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
  used = []
})

const row: EntryInput = {
  project_id: 'p1',
  kind: 'expense',
  category: 'بلاط',
  item: 'سيراميك',
  contractor_id: null,
  bank_id: null,
  amount: 100,
  entry_date: '2026-10-30',
  notes: null,
}

describe('entries: writing', () => {
  it('saves an edit only at the revision that was shown', async () => {
    plan({})
    await updateEntry('e1', 4, row)
    expect(used[0].table).toBe('entries')
    expect(callsOn()).toEqual([
      ['update', [row]],
      ['eq', ['id', 'e1']],
      ['eq', ['rev', 4]],
      ['select', ['id']],
    ])
  })
  it('records a new entry with the custody it was paid from, or none', async () => {
    plan({})
    await insertEntry(row, 'adv1')
    await insertEntry(row, null)
    expect(callsOn(0)[0]).toEqual(['insert', [{ ...row, advance_id: 'adv1' }]])
    expect(callsOn(1)[0]).toEqual(['insert', [{ ...row, advance_id: null }]])
    expect(callsOn(0)).toContainEqual(['select', ['seq']])
  })
  it('deletes through the database function with the revision and the reason', () => {
    rpc.mockReturnValue(query(ok(true)).query)
    deleteEntry('e1', 4, 'مكرر')
    expect(rpc).toHaveBeenCalledWith('delete_entry', { p_id: 'e1', p_rev: 4, p_reason: 'مكرر' })
  })
  it('reads the history and the dashboard from database functions', () => {
    rpc.mockReturnValue(query(ok([])).query)
    fetchEntryHistory('e1')
    fetchDashboardSummary()
    expect(rpc).toHaveBeenCalledWith('entry_history_of', { p_id: 'e1' })
    expect(rpc).toHaveBeenCalledWith('dashboard_summary')
  })
})

describe('entries: reading', () => {
  it('lists only what one person recorded, newest first, at most 8', async () => {
    plan({})
    await fetchMyEntries('u1')
    expect(callsOn()).toContainEqual(['eq', ['created_by', 'u1']])
    expect(callsOn()).toContainEqual(['order', ['seq', { ascending: false }]])
    expect(callsOn()).toContainEqual(['limit', [8]])
  })

  it('filters by status, and by creator only when one is chosen', async () => {
    plan({ entries: [ok([{ id: 'a' }]), ok([])] })
    expect(await fetchEntriesByStatus(['pending'], '')).toEqual([{ id: 'a' }])
    expect(callsOn(0)).toContainEqual(['in', ['status', ['pending']]])
    expect(callsOn(0).some(([m]) => m === 'eq')).toBe(false)
    await fetchEntriesByStatus(['pending', 'approved'], 'u1')
    expect(callsOn(1)).toContainEqual(['eq', ['created_by', 'u1']])
  })
  it('gives null when a page fails', async () => {
    plan({ entries: [fail] })
    expect(await fetchEntriesByStatus(['pending'], '')).toBeNull()
  })

  it('reads what was decided inside one calendar day', async () => {
    plan({})
    await fetchDecidedOn('2026-10-30')
    const start = new Date('2026-10-30T00:00:00')
    const next = new Date(start)
    next.setDate(next.getDate() + 1)
    expect(callsOn()).toContainEqual(['in', ['status', ['approved', 'rejected']]])
    expect(callsOn()).toContainEqual(['gte', ['decided_at', start.toISOString()]])
    expect(callsOn()).toContainEqual(['lt', ['decided_at', next.toISOString()]])
  })

  it('reads approved expenses, narrowing by the dates that are set', async () => {
    plan({})
    await fetchApprovedExpenses('', '')
    await fetchApprovedExpenses('2026-10-01', '2026-10-28')
    for (const i of [0, 1]) {
      expect(callsOn(i)).toContainEqual(['eq', ['kind', 'expense']])
      expect(callsOn(i)).toContainEqual(['eq', ['status', 'approved']])
    }
    expect(callsOn(0).some(([m]) => m === 'gte' || m === 'lte')).toBe(false)
    expect(callsOn(1)).toContainEqual(['gte', ['entry_date', '2026-10-01']])
    expect(callsOn(1)).toContainEqual(['lte', ['entry_date', '2026-10-28']])
  })
})

describe('catalog', () => {
  it('lists categories with their expense names, alphabetically', async () => {
    plan({})
    await fetchCategories()
    expect(used[0].table).toBe('expense_categories')
    expect(callsOn()).toContainEqual(['order', ['name']])
  })
  it('returns the new id when something was created', async () => {
    plan({
      expense_categories: [ok({ id: 'c1' })],
      contractors: [ok({ id: 'k1' })],
      bank_accounts: [ok({ id: 'b1' })],
    })
    expect(await createCategory('بلاط')).toBe('c1')
    expect(await createContractor('أحمد')).toBe('k1')
    expect(await createBank('الأهلي')).toBe('b1')
    expect(callsOn(1)[0]).toEqual(['insert', [{ name: 'أحمد' }]])
  })
  it('returns null when saving failed or returned nothing', async () => {
    plan({ expense_categories: [fail], contractors: [ok(null)], bank_accounts: [fail] })
    expect(await createCategory('x')).toBeNull()
    expect(await createContractor('x')).toBeNull()
    expect(await createBank('x')).toBeNull()
  })
  it('remembers an expense name under its category', async () => {
    plan({})
    await addExpenseItem('سيراميك', 'c1')
    expect(used[0].table).toBe('expense_items')
    expect(callsOn()[0]).toEqual(['insert', [{ name: 'سيراميك', category_id: 'c1' }]])
  })
})

describe('contractors', () => {
  it('reads one contractor’s dues and payments, and the approved expenses under his name', async () => {
    plan({ contractor_transactions: [ok([{ id: 't1' }])], entries: [ok([{ id: 'e1' }])] })
    expect(await fetchContractorLedger('k1')).toEqual({ txns: [{ id: 't1' }], spent: [{ id: 'e1' }] })
    const txn = used.find((u) => u.table === 'contractor_transactions')!
    const spent = used.find((u) => u.table === 'entries')!
    expect(txn.calls).toContainEqual(['eq', ['contractor_id', 'k1']])
    expect(spent.calls).toContainEqual(['eq', ['contractor_id', 'k1']])
    expect(spent.calls).toContainEqual(['eq', ['status', 'approved']])
  })
  it('gives nothing at all when either half fails, never a half statement', async () => {
    plan({ contractor_transactions: [ok([])], entries: [fail] })
    expect(await fetchContractorLedger('k1')).toBeNull()
    plan({ contractor_transactions: [fail], entries: [ok([])] })
    expect(await fetchContractorLedger('k1')).toBeNull()
  })
  it('reads every contractor transaction for the summary', async () => {
    plan({ contractor_transactions: [ok([{ kind: 'due' }])] })
    expect(await fetchAllContractorTxns()).toEqual([{ kind: 'due' }])
  })
})

describe('saving projects and banks', () => {
  it('inserts without an id and updates with one', async () => {
    plan({})
    const project = { name: 'فيلا', type: 'finishing', status: 'active', budget: 5 } as const
    await saveProject(project)
    await saveProject(project, 'p1')
    expect(used.map((u) => u.table)).toEqual(['projects', 'projects'])
    expect(callsOn(0)[0]).toEqual(['insert', [project]])
    expect(callsOn(1)).toEqual([
      ['update', [project]],
      ['eq', ['id', 'p1']],
    ])
    await saveBank({ name: 'الأهلي', opening_balance: 0 })
    await saveBank({ name: 'الأهلي', opening_balance: 0 }, 'b1')
    expect(used.slice(2).map((u) => u.table)).toEqual(['bank_accounts', 'bank_accounts'])
    expect(callsOn(2)[0][0]).toBe('insert')
    expect(callsOn(3)[0][0]).toBe('update')
  })
})

describe('custody writes', () => {
  it('creates and edits a custody', async () => {
    plan({ advances: [ok({ id: 'a1' })] })
    await createAdvance({ holder_name: 'م. أحمد', notes: null })
    await updateAdvance('a1', { holder_name: 'م. أحمد', notes: 'x' })
    expect(callsOn(0)).toContainEqual(['select', ['id']])
    expect(callsOn(0)).toContainEqual(['single', []])
    expect(callsOn(1)).toContainEqual(['eq', ['id', 'a1']])
  })
  it('opens and closes a custody', async () => {
    plan({})
    await setAdvanceStatus('a1', 'closed')
    expect(callsOn()[0]).toEqual(['update', [{ status: 'closed' }]])
    expect(callsOn()[1]).toEqual(['eq', ['id', 'a1']])
  })
  it('adds the first installment', async () => {
    plan({})
    await addInstallment('a1', 500, '2026-10-30')
    expect(used[0].table).toBe('advance_installments')
    expect(callsOn()[0]).toEqual(['insert', [{ advance_id: 'a1', amount: 500, paid_on: '2026-10-30' }]])
  })
  it('writes installments and returns to their own tables', async () => {
    plan({})
    await saveAdvanceMoney('installment', 'a1', { amount: 5, paid_on: '2026-10-30' })
    await saveAdvanceMoney('return', 'a1', { amount: 5, returned_on: '2026-10-30', notes: null }, 'r1')
    await deleteAdvanceMoney('installment', 'i1')
    await deleteAdvanceMoney('return', 'r1')
    expect(used.map((u) => u.table)).toEqual([
      'advance_installments',
      'advance_returns',
      'advance_installments',
      'advance_returns',
    ])
    expect(callsOn(0)[0]).toEqual(['insert', [{ amount: 5, paid_on: '2026-10-30', advance_id: 'a1' }]])
    expect(callsOn(1)).toContainEqual(['eq', ['id', 'r1']])
    expect(callsOn(1)[0][0]).toBe('update')
    expect(callsOn(2)[0][0]).toBe('delete')
  })
})

describe('user access writes', () => {
  it('changes the role and the active flag of one account', async () => {
    plan({})
    await updateRole('u1', 'owner', false)
    expect(used[0].table).toBe('profiles')
    expect(callsOn()[0]).toEqual(['update', [{ role: 'owner', is_active: false }]])
    expect(callsOn()[1]).toEqual(['eq', ['id', 'u1']])
  })
  it('clears old permissions first, then inserts the new ones', async () => {
    plan({})
    const rows = [{ user_id: 'u1', module: 'projects' as const, level: 'edit' as const }]
    await replacePermissions('u1', rows)
    expect(callsOn(0)[0][0]).toBe('delete')
    expect(callsOn(1)[0]).toEqual(['insert', [rows]])
  })
  it('only clears when there is nothing new to grant', async () => {
    plan({})
    const { cleared, saved } = await replacePermissions('u1', [])
    await replaceAdvanceAccess('u1', [])
    expect(used).toHaveLength(2)
    expect(used.every((u) => callsOn(used.indexOf(u))[0][0] === 'delete')).toBe(true)
    expect(saved).toEqual({ error: null })
    expect(cleared).toBeDefined()
  })
  it('grants the chosen custodies', async () => {
    plan({})
    await replaceAdvanceAccess('u1', ['a1', 'a2'])
    expect(used.map((u) => u.table)).toEqual(['user_advance_access', 'user_advance_access'])
    expect(callsOn(1)[0]).toEqual([
      'insert',
      [
        [
          { user_id: 'u1', advance_id: 'a1' },
          { user_id: 'u1', advance_id: 'a2' },
        ],
      ],
    ])
  })
})
