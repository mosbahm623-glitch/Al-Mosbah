import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))

import { supabase } from '../supabase'
import { SEARCH_LIMIT, searchEntries } from '../search'

const from = vi.mocked(supabase.from)
const ok = (data: unknown) => ({ data, error: null })
const hit = (id: string, seq: number) => ({ id, seq })

/** Entry reads come back in the order the search makes them; other tables have their own queue. */
const plan = (byTable: Record<string, unknown[]>) => {
  const log: { table: string; calls: [string, unknown[]][] }[] = []
  from.mockImplementation(((table: string) => {
    const q = query(byTable[table]?.shift() ?? ok([]))
    log.push({ table, calls: q.calls })
    return q.query
  }) as never)
  return log
}

beforeEach(() => from.mockReset())

describe('searchEntries', () => {
  it('looks in category, name and notes, and strips characters that mean something in a filter', async () => {
    const log = plan({})
    await searchEntries('بلاط%_,(x)')
    const text = log[0].calls
    const filter = text.find(([m]) => m === 'or')?.[1][0]
    // % _ , ( ) are turned into spaces, so the text cannot break out of the filter
    const like = '%بلاط    x%'
    expect(filter).toBe(`category.ilike.${like},item.ilike.${like},notes.ilike.${like}`)
    expect(text).toContainEqual(['limit', [SEARCH_LIMIT]])
  })

  it('also finds entries of projects and contractors whose names match', async () => {
    const log = plan({
      entries: [ok([hit('t', 5)]), ok([hit('p', 6)]), ok([hit('c', 7)])],
      projects: [ok([{ id: 'p1' }])],
      contractors: [ok([{ id: 'k1' }])],
    })
    const res = await searchEntries('فيلا')
    expect(res.error).toBe(false)
    expect(res.data?.map((h) => h.id)).toEqual(['c', 'p', 't'])
    const entryReads = log.filter((l) => l.table === 'entries').map((l) => l.calls)
    expect(entryReads[1]).toContainEqual(['in', ['project_id', ['p1']]])
    expect(entryReads[2]).toContainEqual(['in', ['contractor_id', ['k1']]])
  })

  it('does not read entries of projects or contractors when none matched', async () => {
    const log = plan({ entries: [ok([hit('t', 1)])] })
    await searchEntries('x')
    expect(log.filter((l) => l.table === 'entries')).toHaveLength(1)
  })

  it('puts an exact entry-number match first, then the newest', async () => {
    plan({ entries: [ok([hit('a', 90), hit('b', 12)]), ok([hit('exact', 7)])] })
    const res = await searchEntries('#7')
    expect(res.data?.map((h) => h.id)).toEqual(['exact', 'a', 'b'])
  })

  it('lists an entry once even when several searches found it', async () => {
    plan({ entries: [ok([hit('a', 3)]), ok([hit('a', 3)])] })
    const res = await searchEntries('3')
    expect(res.data).toHaveLength(1)
  })

  it('ignores numbers too big for the database', async () => {
    const log = plan({})
    await searchEntries('99999999999')
    expect(log.filter((l) => l.table === 'entries')).toHaveLength(1)
  })

  it('fails as a whole when any read fails', async () => {
    plan({ entries: [ok([])], projects: [{ data: null, error: new Error('x') }] })
    expect(await searchEntries('x')).toEqual({ data: null, error: true })
  })
  it('fails as a whole when the second round fails', async () => {
    plan({
      entries: [ok([]), { data: null, error: new Error('x') }],
      projects: [ok([{ id: 'p1' }])],
    })
    expect(await searchEntries('x')).toEqual({ data: null, error: true })
  })
})
