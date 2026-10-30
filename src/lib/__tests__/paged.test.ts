import { describe, expect, it, vi } from 'vitest'
import { fetchPaged } from '../paged'

const source = (total: number) => {
  const rows = Array.from({ length: total }, (_, i) => i)
  return vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null }))
}

describe('fetchPaged', () => {
  it('returns one page when it is not full', async () => {
    const page = source(3)
    expect(await fetchPaged(page, 5)).toEqual([0, 1, 2])
    expect(page).toHaveBeenCalledTimes(1)
  })
  it('keeps reading until a page comes back short', async () => {
    const page = source(12)
    const all = await fetchPaged(page, 5)
    expect(all).toHaveLength(12)
    expect(all).toEqual(Array.from({ length: 12 }, (_, i) => i))
    expect(page.mock.calls).toEqual([
      [0, 4],
      [5, 9],
      [10, 14],
    ])
  })
  it('needs one extra empty page when the total is an exact multiple', async () => {
    const page = source(10)
    expect(await fetchPaged(page, 5)).toHaveLength(10)
    expect(page).toHaveBeenCalledTimes(3)
  })
  it('returns an empty list for no rows', async () => {
    expect(await fetchPaged(source(0), 5)).toEqual([])
  })
  it('gives null when any page fails, so a partial list is never shown', async () => {
    const page = vi
      .fn()
      .mockResolvedValueOnce({ data: [1, 2, 3, 4, 5], error: null })
      .mockResolvedValueOnce({ data: null, error: new Error('boom') })
    expect(await fetchPaged(page, 5)).toBeNull()
  })
  it('gives null when a page has neither data nor error', async () => {
    expect(await fetchPaged(async () => ({ data: null, error: null }), 5)).toBeNull()
  })
})
