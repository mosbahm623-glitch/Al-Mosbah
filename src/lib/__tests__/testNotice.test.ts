import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { supabase } from '../supabase'
import { fetchPushDevices, sendTestNotification } from '../testNotice'

const rpc = vi.mocked(supabase.rpc)

beforeEach(() => vi.clearAllMocks())

describe('sendTestNotification', () => {
  it('sends to the chosen accounts and returns how many got it', async () => {
    rpc.mockResolvedValue({ data: 2, error: null } as never)
    expect(await sendTestNotification(['u1', 'u2'])).toBe(2)
    expect(rpc).toHaveBeenCalledWith('send_test_notification', { p_users: ['u1', 'u2'] })
  })

  it('returns null when the database refuses (not an admin)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'admin only', code: '42501' } } as never)
    expect(await sendTestNotification(['u1'])).toBeNull()
  })

  it('returns null when the answer is not a number', async () => {
    rpc.mockResolvedValue({ data: null, error: null } as never)
    expect(await sendTestNotification(null)).toBeNull()
  })
})

describe('fetchPushDevices', () => {
  it('returns the number of registered phones per account', async () => {
    rpc.mockResolvedValue({ data: { u1: 2, u2: 1 }, error: null } as never)
    expect(await fetchPushDevices()).toEqual({ u1: 2, u2: 1 })
  })

  it('ignores anything that is not a count, and returns null on an error or a list', async () => {
    rpc.mockResolvedValueOnce({ data: { u1: 'x', u2: 3 }, error: null } as never)
    expect(await fetchPushDevices()).toEqual({ u2: 3 })
    rpc.mockResolvedValueOnce({ data: [], error: null } as never)
    expect(await fetchPushDevices()).toBeNull()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'x' } } as never)
    expect(await fetchPushDevices()).toBeNull()
  })
})
