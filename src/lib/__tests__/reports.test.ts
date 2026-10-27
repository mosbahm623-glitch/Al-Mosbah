import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '../projects'
import { balanceOf, filterProjects, totalsOf } from '../reports'

const project = (over: Partial<ProjectSummary>): ProjectSummary => ({
  id: '1', name: 'p', budget: 1000, status: 'active', type: 'finishing', income: 0, expenses: 0, ...over,
})

describe('totalsOf', () => {
  it('adds budgets, income and expenses and derives the balance', () => {
    const t = totalsOf([
      project({ budget: 1000, income: 800, expenses: 300 }),
      project({ id: '2', budget: 500, income: 100, expenses: 150 }),
    ])
    expect(t).toEqual({ count: 2, budget: 1500, income: 900, expenses: 450, balance: 450, over: 0 })
  })
  it('does not leak floating point noise', () => {
    const t = totalsOf([project({ income: 0.1, expenses: 0 }), project({ id: '2', income: 0.2, expenses: 0 })])
    expect(t.income).toBe(0.3)
    expect(t.balance).toBe(0.3)
  })
  it('counts only projects that went past their budget', () => {
    const t = totalsOf([
      project({ expenses: 1000 }),
      project({ id: '2', expenses: 1001 }),
      project({ id: '3', budget: 0, expenses: 5000 }),
    ])
    expect(t.over).toBe(1)
  })
  it('is all zeros for an empty list', () => {
    expect(totalsOf([])).toEqual({ count: 0, budget: 0, income: 0, expenses: 0, balance: 0, over: 0 })
  })
})

describe('balanceOf', () => {
  it('is income minus expenses, negative when overspent', () => {
    expect(balanceOf({ income: 500, expenses: 200.5 })).toBe(299.5)
    expect(balanceOf({ income: 100, expenses: 250 })).toBe(-150)
  })
})

describe('filterProjects', () => {
  const rows = [
    project({ id: 'a', status: 'active', type: 'finishing' }),
    project({ id: 'b', status: 'closed', type: 'finishing' }),
    project({ id: 'c', status: 'active', type: 'furnishing' }),
  ]
  it('keeps everything with the "all" filters', () => {
    expect(filterProjects(rows, 'all', 'all')).toHaveLength(3)
  })
  it('filters by status and by type together', () => {
    expect(filterProjects(rows, 'active', 'all').map((p) => p.id)).toEqual(['a', 'c'])
    expect(filterProjects(rows, 'all', 'furnishing').map((p) => p.id)).toEqual(['c'])
    expect(filterProjects(rows, 'closed', 'furnishing')).toEqual([])
  })
})
