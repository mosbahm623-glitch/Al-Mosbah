import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../supabase'
import { fetchAdvanceEntries, fetchAdvanceSummaries, fetchInstallments, fetchReturns } from '../advances'
import { fetchBankMovements, fetchBankSummaries } from '../banks'
import { fetchBankNames, fetchContractorNames, fetchPeople } from '../lookups'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
})

/** Runs `fn` against a fake query and returns which table was read and which calls were made. */
async function run(fn: () => unknown, result: unknown = { data: [], error: null }) {
  const q = query(result)
  from.mockReturnValueOnce(q.query)
  await fn()
  return q.calls
}

describe('custody (العهد) queries', () => {
  it('reads installments of one custody, newest payment first', async () => {
    const calls = await run(() => fetchInstallments('adv1'))
    expect(from).toHaveBeenCalledWith('advance_installments')
    expect(calls).toContainEqual(['eq', ['advance_id', 'adv1']])
    expect(calls).toContainEqual(['order', ['paid_on', { ascending: false }]])
  })
  it('reads returns of one custody, newest first', async () => {
    const calls = await run(() => fetchReturns('adv1'))
    expect(from).toHaveBeenCalledWith('advance_returns')
    expect(calls).toContainEqual(['eq', ['advance_id', 'adv1']])
    expect(calls).toContainEqual(['order', ['returned_on', { ascending: false }]])
  })
  it('reads the expenses paid from one custody, latest entry number first', async () => {
    const calls = await run(() => fetchAdvanceEntries('adv1'))
    expect(from).toHaveBeenCalledWith('entries')
    expect(calls).toContainEqual(['eq', ['advance_id', 'adv1']])
    expect(calls).toContainEqual(['order', ['seq', { ascending: false }]])
  })
  it('takes the totals from the database function', () => {
    rpc.mockReturnValueOnce(query({ data: [], error: null }).query)
    fetchAdvanceSummaries()
    expect(rpc).toHaveBeenCalledWith('advance_summaries')
  })
})

describe('bank queries', () => {
  it('takes the totals from the database function', () => {
    rpc.mockReturnValue(query({ data: [], error: null }).query)
    fetchBankSummaries()
    fetchBankMovements('b1')
    expect(rpc).toHaveBeenCalledWith('bank_summaries')
    expect(rpc).toHaveBeenCalledWith('bank_movements', { p_bank: 'b1' })
  })
})

describe('lookups', () => {
  it('lists contractors, banks and people alphabetically', async () => {
    expect(await run(() => fetchContractorNames())).toContainEqual(['order', ['name']])
    expect(from).toHaveBeenLastCalledWith('contractors')
    expect(await run(() => fetchBankNames())).toContainEqual(['order', ['name']])
    expect(from).toHaveBeenLastCalledWith('bank_accounts')
    expect(await run(() => fetchPeople())).toContainEqual(['order', ['full_name']])
    expect(from).toHaveBeenLastCalledWith('profiles')
  })
})
