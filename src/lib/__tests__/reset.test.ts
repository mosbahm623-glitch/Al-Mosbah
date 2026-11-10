import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

const remove = vi.fn()
vi.mock('../supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: () => ({ remove }) } },
}))
vi.mock('../offline/connection', () => ({ isOnline: vi.fn() }))
vi.mock('../offline/fetch', () => ({ clearReadCache: vi.fn() }))
vi.mock('../offline/queue', () => ({ queueSnapshot: vi.fn(), discardQueued: vi.fn() }))
vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))

import { supabase } from '../supabase'
import { isOnline } from '../offline/connection'
import { clearReadCache } from '../offline/fetch'
import { discardQueued, queueSnapshot, type QueuedEntry } from '../offline/queue'
import { notifyDataChanged } from '../events'
import { ALL_DATA_GROUPS, RESET_GROUPS, resetData, withRequired } from '../reset'

const from = vi.mocked(supabase.from)
const rpc = vi.mocked(supabase.rpc)

const paths = (...p: string[]) => ({ data: p.map((path) => ({ path })), error: null })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isOnline).mockReturnValue(true)
  vi.mocked(queueSnapshot).mockReturnValue([])
  remove.mockResolvedValue({ error: null })
  rpc.mockResolvedValue({ data: null, error: null } as never)
  from.mockImplementation((() => query(paths('e1/a.jpg', 'e2/b.jpg')).query) as never)
})

describe('withRequired', () => {
  it('adds what a group needs and nothing more', () => {
    expect([...withRequired(['projects'])].sort()).toEqual(['contractor_dues', 'entries', 'projects'])
    expect([...withRequired(['banks'])].sort()).toEqual(['banks', 'entries'])
    expect([...withRequired(['categories'])]).toEqual(['categories'])
    expect([...withRequired(['users'])].sort()).toEqual(['advances', 'contractor_dues', 'entries', 'users'])
  })

  it('every group a group needs is a real group, and the list needs nothing from itself', () => {
    const ids = new Set(RESET_GROUPS.map((g) => g.id))
    for (const g of RESET_GROUPS) {
      expect(g.requires.every((r) => ids.has(r) && r !== g.id)).toBe(true)
      // one step is enough: whatever a needed group needs is already in this group's own list
      for (const r of g.requires) {
        const deeper = RESET_GROUPS.find((x) => x.id === r)?.requires ?? []
        expect(deeper.every((d) => g.requires.includes(d))).toBe(true)
      }
    }
  })

  it('"all data" leaves the users out', () => {
    expect(ALL_DATA_GROUPS).not.toContain('users')
    expect(withRequired(ALL_DATA_GROUPS).has('users')).toBe(false)
  })
})

describe('resetData', () => {
  it('needs the network and touches nothing without it', async () => {
    vi.mocked(isOnline).mockReturnValue(false)
    const res = await resetData(['categories'])
    expect(res.error).toMatch(/إنترنت/)
    expect(rpc).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('does nothing when nothing is picked', async () => {
    const res = await resetData([])
    expect(res.error).toMatch(/اختار/)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('sends the picked groups together with what they need', async () => {
    await resetData(['projects'])
    const [name, args] = rpc.mock.calls[0] as unknown as [string, { p_groups: string[] }]
    expect(name).toBe('reset_data')
    expect([...args.p_groups].sort()).toEqual(['contractor_dues', 'entries', 'projects'])
  })

  it('wipes the entries: removes the photos, drops what this device queued, clears the caches', async () => {
    vi.mocked(queueSnapshot).mockReturnValue([{ id: 'q1' }, { id: 'q2' }] as QueuedEntry[])
    const res = await resetData(ALL_DATA_GROUPS)
    expect(res).toEqual({ error: null, photosLeft: false })
    expect(remove).toHaveBeenCalledWith(['e1/a.jpg', 'e2/b.jpg'])
    expect(discardQueued).toHaveBeenCalledTimes(2)
    expect(clearReadCache).toHaveBeenCalled()
    expect(notifyDataChanged).toHaveBeenCalled()
  })

  it('leaves photos and the waiting entries alone when the entries are not wiped', async () => {
    vi.mocked(queueSnapshot).mockReturnValue([{ id: 'q1' }] as QueuedEntry[])
    const res = await resetData(['categories'])
    expect(res).toEqual({ error: null, photosLeft: false })
    expect(from).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(discardQueued).not.toHaveBeenCalled()
    expect(notifyDataChanged).toHaveBeenCalled()
  })

  it('keeps every photo and every record when the database refuses', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'admin only' } } as never)
    const res = await resetData(ALL_DATA_GROUPS)
    expect(res.error).toMatch(/ما اتمسحش/)
    expect(remove).not.toHaveBeenCalled()
    expect(clearReadCache).not.toHaveBeenCalled()
    expect(notifyDataChanged).not.toHaveBeenCalled()
  })

  it('still succeeds, and says so, when a photo file cannot be removed', async () => {
    remove.mockResolvedValue({ error: { message: 'boom' } })
    const res = await resetData(['entries'])
    expect(res).toEqual({ error: null, photosLeft: true })
    expect(notifyDataChanged).toHaveBeenCalled()
  })

  it('removes the photos in batches of 100', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `e/${i}.jpg`)
    from.mockImplementation((() => query(paths(...many)).query) as never)
    await resetData(['entries'])
    expect(remove).toHaveBeenCalledTimes(3)
    expect(remove.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([100, 100, 50])
  })
})
