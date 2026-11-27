import { describe, expect, it, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))
import { alertPayload } from '../advances/alerts'

const all = { to_admin: true, to_holder: true, to_owner: true }
const none = { to_admin: false, to_holder: false, to_owner: false }

describe('custody alert settings', () => {
  it('parses the limits and keeps a disabled custody without one', () => {
    expect(
      alertPayload(all, [
        { id: 'a', enabled: true, limit: '5,000' },
        { id: 'b', enabled: false, limit: '' },
      ]).rows,
    ).toEqual([
      { id: 'a', enabled: true, threshold: 5000 },
      { id: 'b', enabled: false, threshold: null },
    ])
  })

  it('refuses a missing or wrong limit, and nobody to receive', () => {
    expect(alertPayload(all, [{ id: 'a', enabled: true, limit: ' ' }]).error).toBeTruthy()
    expect(alertPayload(all, [{ id: 'a', enabled: true, limit: '-1' }]).error).toBeTruthy()
    expect(alertPayload(all, [{ id: 'a', enabled: true, limit: 'abc' }]).error).toBeTruthy()
    expect(alertPayload(none, [{ id: 'a', enabled: true, limit: '1' }]).error).toBeTruthy()
  })

  it('allows turning everything off', () => {
    expect(alertPayload(none, [{ id: 'a', enabled: false, limit: '' }]).rows).toHaveLength(1)
  })
})
