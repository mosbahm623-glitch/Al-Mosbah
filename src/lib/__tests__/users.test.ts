import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), functions: { invoke: vi.fn() } } }))

import { supabase } from '../supabase'
import { createUser, fetchUsers } from '../users'

const from = vi.mocked(supabase.from)
const invoke = vi.mocked(supabase.functions.invoke)

beforeEach(() => {
  from.mockReset()
  invoke.mockReset()
})

const tables = (t: Record<string, unknown>) =>
  from.mockImplementation(((name: string) => query(t[name]).query) as never)

describe('fetchUsers', () => {
  const profile = (id: string) => ({
    id,
    full_name: id,
    email: `${id}@x.com`,
    role: 'user',
    is_active: true,
    notify_low_balance: false,
  })

  it('attaches each user’s page permissions and custody access', async () => {
    tables({
      profiles: { data: [profile('u1'), profile('u2')], error: null },
      user_permissions: {
        data: [
          { user_id: 'u1', module: 'projects', level: 'edit' },
          { user_id: 'u1', module: 'banks', level: 'view' },
        ],
        error: null,
      },
      user_advance_access: { data: [{ user_id: 'u2', advance_id: 'a1' }], error: null },
    })
    const { data, error } = await fetchUsers()
    expect(error).toBeNull()
    expect(data?.map((u) => u.id)).toEqual(['u1', 'u2'])
    expect(data?.[0].permissions).toEqual([
      { module: 'projects', level: 'edit' },
      { module: 'banks', level: 'view' },
    ])
    expect(data?.[0].advanceIds).toEqual([])
    expect(data?.[1].permissions).toEqual([])
    expect(data?.[1].advanceIds).toEqual(['a1'])
  })

  it('fails as a whole when any of the three reads fails, never half a list', async () => {
    const boom = new Error('rls')
    tables({
      profiles: { data: [profile('u1')], error: null },
      user_permissions: { data: null, error: boom },
      user_advance_access: { data: [], error: null },
    })
    expect(await fetchUsers()).toEqual({ data: null, error: boom })
  })
})

describe('createUser', () => {
  const input = { full_name: 'محمد', email: 'm@x.com', password: '12345678' }

  it('returns null when the account was created', async () => {
    invoke.mockResolvedValueOnce({ data: { id: 'u1' }, error: null } as never)
    expect(await createUser(input)).toBeNull()
    expect(invoke).toHaveBeenCalledWith('create-user', { body: input })
  })
  it('translates the server error codes to a readable message', async () => {
    invoke.mockResolvedValueOnce({ data: { error: 'email_exists' }, error: null } as never)
    expect(await createUser(input)).toBe('الإيميل ده مسجّل قبل كده')
    invoke.mockResolvedValueOnce({ data: { error: 'forbidden' }, error: null } as never)
    expect(await createUser(input)).toBe('الأدمن بس هو اللي يضيف مستخدمين')
  })
  it('reads the error code from a failed HTTP response too', async () => {
    const context = { json: async () => ({ error: 'weak_password' }) }
    invoke.mockResolvedValueOnce({ data: null, error: { context } } as never)
    expect(await createUser(input)).toBe('كلمة السر لازم 8 حروف على الأقل')
  })
  it('falls back to a generic message for unknown codes or an unreadable body', async () => {
    const generic = 'ما قدرناش ننشئ المستخدم، جرّب تاني'
    invoke.mockResolvedValueOnce({ data: { error: 'something_new' }, error: null } as never)
    expect(await createUser(input)).toBe(generic)
    const context = {
      json: async () => {
        throw new Error('no body')
      },
    }
    invoke.mockResolvedValueOnce({ data: null, error: { context } } as never)
    expect(await createUser(input)).toBe(generic)
  })
})
