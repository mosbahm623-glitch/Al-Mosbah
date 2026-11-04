import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: { rpc: vi.fn() } }))

import { supabase } from '../supabase'
import { sendMessage } from '../messages'

const rpc = vi.mocked(supabase.rpc)

beforeEach(() => vi.clearAllMocks())

describe('sendMessage', () => {
  it('sends the trimmed text to the chosen accounts and returns how many got it', async () => {
    rpc.mockResolvedValue({ data: 2, error: null } as never)
    expect(await sendMessage(['u1', 'u2'], '  تنبيه  ', ' اجتماع بكرة ')).toBe(2)
    expect(rpc).toHaveBeenCalledWith('send_message', { p_users: ['u1', 'u2'], p_title: 'تنبيه', p_body: 'اجتماع بكرة' })
  })

  it('sends no body when it is empty', async () => {
    rpc.mockResolvedValue({ data: 1, error: null } as never)
    await sendMessage(['u1'], 'تنبيه', '   ')
    expect(rpc).toHaveBeenCalledWith('send_message', { p_users: ['u1'], p_title: 'تنبيه', p_body: null })
  })

  it('returns null when the database refuses (not an admin, bad length)', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'admin only', code: '42501' } } as never)
    expect(await sendMessage(['u1'], 'تنبيه', '')).toBeNull()
  })
})
