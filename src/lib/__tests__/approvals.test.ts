import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../supabase'
import { countPending, decide, fetchByStatus, restoreEntry } from '../approvals'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
})

describe('decide', () => {
  it('approves entries only at the revision they were shown (nobody changed them meanwhile)', async () => {
    const a = query({ data: [{ id: 'a' }], error: null })
    const b = query({ data: [{ id: 'b' }], error: null })
    from.mockReturnValueOnce(a.query).mockReturnValueOnce(b.query)

    await decide(
      [
        { id: 'a', rev: 3 },
        { id: 'b', rev: 7 },
      ],
      'approved',
    )

    expect(from).toHaveBeenCalledWith('entries')
    expect(a.calls).toEqual([
      ['update', [{ status: 'approved' }]],
      ['eq', ['id', 'a']],
      ['eq', ['rev', 3]],
      ['select', ['id']],
    ])
    expect(b.calls).toContainEqual(['eq', ['rev', 7]])
  })

  it('counts everything as done when every update went through', async () => {
    from.mockReturnValue(query({ data: [{ id: 'x' }], error: null }).query)
    expect(
      await decide(
        [
          { id: 'a', rev: 1 },
          { id: 'b', rev: 1 },
        ],
        'rejected',
      ),
    ).toEqual({ failed: false, done: 2, skipped: 0 })
  })

  it('reports entries that changed in the meantime as skipped, not failed', async () => {
    from
      .mockReturnValueOnce(query({ data: [{ id: 'a' }], error: null }).query)
      .mockReturnValueOnce(query({ data: [], error: null }).query)
    expect(
      await decide(
        [
          { id: 'a', rev: 1 },
          { id: 'b', rev: 1 },
        ],
        'approved',
      ),
    ).toEqual({ failed: false, done: 1, skipped: 1 })
  })

  it('flags a failure and does not count the failed one as skipped', async () => {
    from
      .mockReturnValueOnce(query({ data: [{ id: 'a' }], error: null }).query)
      .mockReturnValueOnce(query({ data: null, error: new Error('rls') }).query)
    expect(
      await decide(
        [
          { id: 'a', rev: 1 },
          { id: 'b', rev: 1 },
        ],
        'approved',
      ),
    ).toEqual({ failed: true, done: 1, skipped: 0 })
  })

  it('does nothing for an empty selection', async () => {
    expect(await decide([], 'approved')).toEqual({ failed: false, done: 0, skipped: 0 })
    expect(from).not.toHaveBeenCalled()
  })
})

describe('countPending', () => {
  it('returns the number of pending entries', async () => {
    const q = query({ count: 4 })
    from.mockReturnValueOnce(q.query)
    expect(await countPending()).toBe(4)
    expect(q.calls).toContainEqual(['eq', ['status', 'pending']])
  })
  it('is zero when the count is missing (request failed)', async () => {
    from.mockReturnValueOnce(query({ count: null }).query)
    expect(await countPending()).toBe(0)
  })
})

describe('fetchByStatus', () => {
  it('lists the oldest first, so the earliest request is handled first', async () => {
    const q = query({ data: [], error: null })
    from.mockReturnValueOnce(q.query)
    await fetchByStatus('rejected')
    expect(from).toHaveBeenCalledWith('entries')
    expect(q.calls).toContainEqual(['eq', ['status', 'rejected']])
    expect(q.calls).toContainEqual(['order', ['created_at', { ascending: true }]])
  })
})

describe('restoreEntry', () => {
  it('is true only when the database confirms the restore', async () => {
    rpc.mockReturnValueOnce(query({ data: true, error: null }).query)
    expect(await restoreEntry('e1')).toBe(true)
    expect(rpc).toHaveBeenCalledWith('restore_entry', { p_id: 'e1' })
  })
  it('is false when nothing was restored or the call failed', async () => {
    rpc.mockReturnValueOnce(query({ data: false, error: null }).query)
    expect(await restoreEntry('e1')).toBe(false)
    rpc.mockReturnValueOnce(query({ data: null, error: new Error('x') }).query)
    expect(await restoreEntry('e1')).toBe(false)
  })
})
