import { describe, expect, it } from 'vitest'
import { pageButtons } from '../usePages'

describe('pageButtons', () => {
  it('shows every number when there are few pages', () => {
    expect(pageButtons(1, 1)).toEqual([1])
    expect(pageButtons(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('keeps the first and last page and marks the gaps', () => {
    expect(pageButtons(1, 8)).toEqual([1, 2, null, 8])
    expect(pageButtons(5, 10)).toEqual([1, null, 4, 5, 6, null, 10])
    expect(pageButtons(8, 8)).toEqual([1, null, 7, 8])
  })

  it('fills a gap of one page with its number instead of dots', () => {
    expect(pageButtons(4, 8)).toEqual([1, 2, 3, 4, 5, null, 8])
    expect(pageButtons(5, 8)).toEqual([1, null, 4, 5, 6, 7, 8])
  })
})
