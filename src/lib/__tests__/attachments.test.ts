import { describe, expect, it, vi } from 'vitest'

const storage = vi.hoisted(() => ({ createSignedUrls: vi.fn() }))
vi.mock('../supabase', () => ({ supabase: { storage: { from: () => storage } } }))

import { invoiceCount, signedUrls } from '../attachments'

describe('invoiceCount', () => {
  it('reads the embedded count and treats a missing one as zero', () => {
    expect(invoiceCount({ invoices: [{ count: 3 }] })).toBe(3)
    expect(invoiceCount({ invoices: [] })).toBe(0)
    expect(invoiceCount({})).toBe(0)
  })
})

describe('signedUrls', () => {
  it('asks for nothing when there are no photos', async () => {
    expect(await signedUrls([])).toEqual({})
    expect(storage.createSignedUrls).not.toHaveBeenCalled()
  })

  it('maps each path to its link and skips the ones that failed', async () => {
    storage.createSignedUrls.mockResolvedValueOnce({
      data: [
        { path: 'a/1.jpg', signedUrl: 'https://x/1' },
        { path: 'a/2.jpg', signedUrl: '', error: 'not found' },
      ],
      error: null,
    })
    expect(await signedUrls(['a/1.jpg', 'a/2.jpg'])).toEqual({ 'a/1.jpg': 'https://x/1' })
  })
})
