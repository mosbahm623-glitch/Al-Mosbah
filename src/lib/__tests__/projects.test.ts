import { describe, expect, it } from 'vitest'
import { dateText, money } from '../format'
import { isOver, percentOf, type ProjectSummary } from '../projects'

const project = (over: Partial<ProjectSummary>): ProjectSummary => ({
  id: '1', name: 'p', budget: 1000, status: 'active', type: 'finishing', income: 0, expenses: 0, ...over,
})

describe('budget usage', () => {
  it('computes the percentage of budget spent', () => {
    expect(percentOf(project({ expenses: 250 }))).toBe(25)
    expect(percentOf(project({ expenses: 1070 }))).toBe(107)
  })
  it('is 0% and never "over" when there is no budget', () => {
    const p = project({ budget: 0, expenses: 500 })
    expect(percentOf(p)).toBe(0)
    expect(isOver(p)).toBe(false)
  })
  it('flags only spending above the budget', () => {
    expect(isOver(project({ expenses: 1000 }))).toBe(false)
    expect(isOver(project({ expenses: 1000.01 }))).toBe(true)
  })
})

describe('formatting', () => {
  it('uses western digits with thousands separators', () => {
    expect(money(1284500)).toMatch(/1.284.500/)
    expect(money(0)).toBe('0')
  })
  it('turns an ISO date into dd-mm-yyyy', () => {
    expect(dateText('2026-10-27')).toBe('27-10-2026')
  })
})
