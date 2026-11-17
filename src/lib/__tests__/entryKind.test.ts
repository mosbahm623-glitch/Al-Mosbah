import { describe, expect, it } from 'vitest'
import { entryTitle, isMoneyIn, isRefund, kindLabel, signedAmount } from '../entryKind'

const expense = { kind: 'expense', amount: 500, category: 'كهرباء', item: 'أسلاك' } as const
const refund = { ...expense, amount: -500 }
const income = { kind: 'income', amount: 800, category: 'دفعة عميل', item: null } as const

describe('refund (مرتجع) = expense with a negative amount', () => {
  it('tells the three kinds apart', () => {
    expect([isRefund(expense), isRefund(refund), isRefund(income)]).toEqual([false, true, false])
    expect([kindLabel(expense), kindLabel(refund), kindLabel(income)]).toEqual(['مصروف', 'مرتجع', 'وارد'])
  })

  it('counts a refund as money in, with a plus and no minus inside the number', () => {
    expect(isMoneyIn(refund)).toBe(true)
    expect(isMoneyIn(expense)).toBe(false)
    expect(signedAmount(refund)).toEqual({ sign: '+', value: 500 })
    expect(signedAmount(expense)).toEqual({ sign: '−', value: 500 })
  })

  it('titles a refund like an expense', () => {
    expect(entryTitle(refund)).toBe('كهرباء · أسلاك')
    expect(entryTitle(income)).toBe('دفعة عميل')
  })
})
