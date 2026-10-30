import { describe, expect, it } from 'vitest'
import { sumMoney, toCents } from '../money'

describe('toCents', () => {
  it('rounds to whole cents', () => {
    expect(toCents(10)).toBe(1000)
    expect(toCents(0.1)).toBe(10)
    expect(toCents(19.999)).toBe(2000)
  })
  it('keeps the sign', () => {
    expect(toCents(-5.25)).toBe(-525)
  })
})

describe('sumMoney', () => {
  it('has no floating point noise', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
  })
  it('converts to cents before adding, so odd amounts stay exact', () => {
    expect(0.07 * 100).not.toBe(7)
    expect(sumMoney([0.07, 0.01])).toBe(0.08)
    expect(sumMoney([19.99, 0.01, 0.07])).toBe(20.07)
  })
  it('adds many small amounts exactly', () => {
    expect(sumMoney(Array.from({ length: 100 }, () => 0.01))).toBe(1)
  })
  it('is zero for an empty list and accepts any iterable', () => {
    expect(sumMoney([])).toBe(0)
    expect(sumMoney(new Set([1.5, 2.5]))).toBe(4)
  })
  it('handles negatives (refunds)', () => {
    expect(sumMoney([100, -40.5])).toBe(59.5)
  })
})
