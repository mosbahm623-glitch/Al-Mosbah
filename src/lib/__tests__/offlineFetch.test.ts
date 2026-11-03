import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createOfflineFetch, isCacheable } from '../offline/fetch'
import { kvClear } from '../offline/store'

const BASE = 'https://x.supabase.co'
const token = (sub: string) => `h.${btoa(JSON.stringify({ sub, role: 'authenticated' })).replace(/=/g, '')}.s`
const headers = (sub: string) => ({ authorization: `Bearer ${token(sub)}`, apikey: 'k' })
const settle = () => new Promise((r) => setTimeout(r, 10))
const json = (body: unknown, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...extra } })

describe('isCacheable', () => {
  it('keeps reads of tables and the read-only functions', () => {
    expect(isCacheable('GET', `${BASE}/rest/v1/projects?select=id`)).toBe(true)
    expect(isCacheable('HEAD', `${BASE}/rest/v1/entries?select=id`)).toBe(true)
    expect(isCacheable('POST', `${BASE}/rest/v1/rpc/dashboard_summary`)).toBe(true)
  })

  it('never keeps writes, changing functions, sign-in or storage', () => {
    expect(isCacheable('POST', `${BASE}/rest/v1/entries`)).toBe(false)
    expect(isCacheable('PATCH', `${BASE}/rest/v1/entries?id=eq.1`)).toBe(false)
    expect(isCacheable('POST', `${BASE}/rest/v1/rpc/edit_entry`)).toBe(false)
    expect(isCacheable('POST', `${BASE}/rest/v1/rpc/delete_entry`)).toBe(false)
    expect(isCacheable('GET', `${BASE}/auth/v1/user`)).toBe(false)
    expect(isCacheable('GET', `${BASE}/storage/v1/object/sign/x`)).toBe(false)
  })
})

describe('createOfflineFetch', () => {
  beforeEach(() => kvClear('cache'))

  it('serves the last copy of a read when the network fails', async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(json([{ id: 1 }], { 'content-range': '0-0/1' }))
    const f = createOfflineFetch(base)
    const url = `${BASE}/rest/v1/projects?select=id`
    await f(url, { headers: headers('u1') })
    await settle()

    base.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await f(url, { headers: headers('u1') })
    expect(res.headers.get('x-offline-cache')).toBe('1')
    expect(res.headers.get('content-range')).toBe('0-0/1')
    expect(await res.json()).toEqual([{ id: 1 }])
  })

  it('rethrows when there is no copy to serve', async () => {
    const f = createOfflineFetch(vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(f(`${BASE}/rest/v1/never_seen`, { headers: headers('u1') })).rejects.toThrow('Failed to fetch')
  })

  it("never shows one person's copy to another", async () => {
    const base = vi.fn<typeof fetch>().mockResolvedValueOnce(json([{ secret: true }]))
    const f = createOfflineFetch(base)
    const url = `${BASE}/rest/v1/entries?select=id`
    await f(url, { headers: headers('u1') })
    await settle()
    base.mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(f(url, { headers: headers('u2') })).rejects.toThrow()
  })

  it('does not replay writes: a failed insert is an error, not an old answer', async () => {
    const base = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const f = createOfflineFetch(base)
    await expect(
      f(`${BASE}/rest/v1/entries`, { method: 'POST', headers: headers('u1'), body: '{"amount":5}' }),
    ).rejects.toThrow()
  })

  it('keeps read-only database functions apart by their arguments', async () => {
    const base = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ for: 'a' }))
      .mockResolvedValueOnce(json({ for: 'b' }))
    const f = createOfflineFetch(base)
    const url = `${BASE}/rest/v1/rpc/bank_movements`
    await f(url, { method: 'POST', headers: headers('u1'), body: '{"p_bank":"a"}' })
    await f(url, { method: 'POST', headers: headers('u1'), body: '{"p_bank":"b"}' })
    await settle()
    base.mockRejectedValue(new TypeError('Failed to fetch'))
    const res = await f(url, { method: 'POST', headers: headers('u1'), body: '{"p_bank":"a"}' })
    expect(await res.json()).toEqual({ for: 'a' })
  })

  it('does not hide a cancelled request behind an old copy', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const f = createOfflineFetch(vi.fn<typeof fetch>().mockRejectedValue(abort))
    await expect(f(`${BASE}/rest/v1/projects`, { headers: headers('u1') })).rejects.toThrow('aborted')
  })
})
