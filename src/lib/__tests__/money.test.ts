import { describe, expect, it } from 'vitest'
import { addMoney, subMoney, sumMoney, toCents } from '../money'

describe('money helpers', () => {
  it('rounds to whole cents', () => {
    expect(toCents(0.1)).toBe(10)
    expect(toCents(1.005 * 1000)).toBe(100500)
  })
  it('sums without floating-point noise', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(addMoney(0.1, 0.2, 0.7)).toBe(1)
  })
  it('subtracts without floating-point noise', () => {
    expect(0.3 - 0.1).not.toBe(0.2)
    expect(subMoney(0.3, 0.1)).toBe(0.2)
    expect(subMoney(100, 250.55)).toBe(-150.55)
  })
})
