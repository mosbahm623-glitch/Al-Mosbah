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
import { resetAllData } from '../reset'

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

describe('resetAllData', () => {
  it('needs the network and touches nothing without it', async () => {
    vi.mocked(isOnline).mockReturnValue(false)
    const res = await resetAllData()
    expect(res.error).toMatch(/إنترنت/)
    expect(rpc).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
  })

  it('resets in the database, removes the photos, and clears what this device kept', async () => {
    vi.mocked(queueSnapshot).mockReturnValue([{ id: 'q1' }, { id: 'q2' }] as QueuedEntry[])
    const res = await resetAllData()
    expect(res).toEqual({ error: null, photosLeft: false })
    expect(rpc).toHaveBeenCalledWith('reset_data')
    expect(remove).toHaveBeenCalledWith(['e1/a.jpg', 'e2/b.jpg'])
    expect(discardQueued).toHaveBeenCalledTimes(2)
    expect(clearReadCache).toHaveBeenCalled()
    expect(notifyDataChanged).toHaveBeenCalled()
  })

  it('keeps every photo and every record when the database refuses', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'admin only' } } as never)
    const res = await resetAllData()
    expect(res.error).toMatch(/ما اتمسحش/)
    expect(remove).not.toHaveBeenCalled()
    expect(clearReadCache).not.toHaveBeenCalled()
    expect(notifyDataChanged).not.toHaveBeenCalled()
  })

  it('still succeeds, and says so, when a photo file cannot be removed', async () => {
    remove.mockResolvedValue({ error: { message: 'boom' } })
    const res = await resetAllData()
    expect(res).toEqual({ error: null, photosLeft: true })
    expect(notifyDataChanged).toHaveBeenCalled()
  })

  it('removes the photos in batches of 100', async () => {
    const many = Array.from({ length: 250 }, (_, i) => `e/${i}.jpg`)
    from.mockImplementation((() => query(paths(...many)).query) as never)
    await resetAllData()
    expect(remove).toHaveBeenCalledTimes(3)
    expect(remove.mock.calls.map((c) => (c[0] as string[]).length)).toEqual([100, 100, 50])
  })
})
