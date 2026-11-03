import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../supabase'
import {
  NO_FILTER,
  countPending,
  decide,
  fetchByStatus,
  filterEntries,
  isFiltering,
  reopenEntry,
  restoreEntry,
  type PendingEntry,
} from '../approvals'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

beforeEach(() => {
  from.mockReset()
  rpc.mockReset()
})

describe('reopenEntry', () => {
  it('only flips the status, at the revision shown (date, number and recorded time are not touched)', async () => {
    const q = query({ data: [{ id: 'a' }], error: null })
    from.mockReturnValueOnce(q.query)
    expect(await reopenEntry('a', 4)).toBe(true)
    expect(q.calls).toEqual([
      ['update', [{ status: 'pending' }]],
      ['eq', ['id', 'a']],
      ['eq', ['rev', 4]],
      ['select', ['id']],
    ])
  })

  it('reports false when someone changed the entry meanwhile', async () => {
    from.mockReturnValueOnce(query({ data: [], error: null }).query)
    expect(await reopenEntry('a', 4)).toBe(false)
  })
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

  it('sends the reason along with a rejection', async () => {
    const a = query({ data: [{ id: 'a' }], error: null })
    from.mockReturnValueOnce(a.query)
    await decide([{ id: 'a', rev: 2 }], 'rejected', '  المبلغ غلط ')
    expect(a.calls[0]).toEqual(['update', [{ status: 'rejected', reject_reason: 'المبلغ غلط' }]])
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

describe('filterEntries', () => {
  const e = (over: Partial<PendingEntry>) =>
    ({
      id: 'x',
      amount: 100,
      item: null,
      category: 'خامات',
      notes: null,
      entry_date: '2026-11-01',
      creator: { full_name: 'Ahmed' },
      bank: null,
      ...over,
    }) as PendingEntry
  const rows = [
    e({ id: 'a', amount: 800, item: 'نقل خامات', bank: { name: 'الأهلي' } }),
    e({ id: 'b', amount: 2000, item: 'أعمال نقاشة', creator: { full_name: 'Mona' }, entry_date: '2026-11-02' }),
    e({ id: 'c', amount: 500, item: 'إيجار معدّات', notes: 'شهر نوفمبر', bank: { name: 'CIB' } }),
  ]
  const ids = (f: Partial<typeof NO_FILTER>) => filterEntries(rows, { ...NO_FILTER, ...f }).map((r) => r.id)

  it('keeps everything when nothing is set', () => {
    expect(ids({})).toEqual(['a', 'b', 'c'])
    expect(isFiltering(NO_FILTER)).toBe(false)
    expect(isFiltering({ ...NO_FILTER, bank: 'CIB' })).toBe(true)
  })
  it('finds words in the description, category or notes, ignoring Arabic spelling variants', () => {
    expect(ids({ text: 'نقاشه' })).toEqual(['b'])
    expect(ids({ text: 'ايجار معدات' })).toEqual(['c'])
    expect(ids({ text: 'نوفمبر' })).toEqual(['c'])
    expect(ids({ text: 'نقل خامات' })).toEqual(['a'])
  })
  it('filters by who recorded it, the bank and the day of the entry', () => {
    expect(ids({ who: 'Mona' })).toEqual(['b'])
    expect(ids({ bank: 'الأهلي' })).toEqual(['a'])
    expect(ids({ day: '2026-11-02' })).toEqual(['b'])
  })
  it('filters by an amount range with both ends included, or an exact amount', () => {
    expect(ids({ min: '500', max: '800' })).toEqual(['a', 'c'])
    expect(ids({ min: '2000' })).toEqual(['b'])
    expect(ids({ max: '499' })).toEqual([])
    expect(ids({ min: '800', max: '800' })).toEqual(['a'])
  })
  it('combines the filters', () => {
    expect(ids({ who: 'Ahmed', min: '600' })).toEqual(['a'])
  })
})
