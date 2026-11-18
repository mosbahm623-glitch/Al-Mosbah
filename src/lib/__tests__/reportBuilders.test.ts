import { describe, expect, it } from 'vitest'
import type { ProjectSummary } from '../projects/projects'
import { budgetRows, categoryTotals, inRange, monthTotals, projectGroups, runLedger } from '../reports/reportBuilders'

const project = (over: Partial<ProjectSummary>): ProjectSummary => ({
  id: '1',
  name: 'p',
  budget: 1000,
  status: 'active',
  type: 'finishing',
  income: 0,
  expenses: 0,
  ...over,
})

describe('categoryTotals', () => {
  it('groups by بند, biggest first, with shares that add up', () => {
    const t = categoryTotals([
      { category: 'كهرباء', amount: 300 },
      { category: 'نقاشة', amount: 600 },
      { category: 'كهرباء', amount: 100 },
    ])
    expect(t).toEqual([
      { category: 'نقاشة', count: 1, total: 600, share: 60 },
      { category: 'كهرباء', count: 2, total: 400, share: 40 },
    ])
  })
  it('has no floating point noise and handles an empty list', () => {
    expect(
      categoryTotals([
        { category: 'a', amount: 0.1 },
        { category: 'a', amount: 0.2 },
      ])[0].total,
    ).toBe(0.3)
    expect(categoryTotals([])).toEqual([])
  })
})

describe('budgetRows', () => {
  const list = [
    project({ id: 'a', name: 'a', expenses: 500 }),
    project({ id: 'b', name: 'b', expenses: 850 }),
    project({ id: 'c', name: 'c', expenses: 1200 }),
    project({ id: 'd', name: 'd', budget: 0, expenses: 9999 }),
    project({ id: 'e', name: 'e', expenses: 1000 }),
  ]
  it('leaves out projects without a budget and sorts by usage', () => {
    expect(budgetRows(list, 'all').map((r) => r.p.id)).toEqual(['c', 'e', 'b', 'a'])
  })
  it('near = 80% to 100% inclusive, over = above the budget', () => {
    expect(budgetRows(list, 'near').map((r) => r.p.id)).toEqual(['e', 'b'])
    expect(budgetRows(list, 'over').map((r) => r.p.id)).toEqual(['c'])
  })
  it('computes what is left', () => {
    expect(budgetRows(list, 'all').find((r) => r.p.id === 'c')?.remaining).toBe(-200)
  })
})

describe('runLedger', () => {
  const rows = [
    { date: '2026-10-01', delta: 100 },
    { date: '2026-10-05', delta: -30 },
    { date: '2026-10-10', delta: 50 },
    { date: '2026-10-20', delta: -10 },
  ]
  it('runs over everything when there is no period', () => {
    const l = runLedger(1000, rows, '', '')
    expect(l.opening).toBe(1000)
    expect(l.rows.map((r) => r.run)).toEqual([1100, 1070, 1120, 1110])
    expect(l.closing).toBe(1110)
  })
  it('folds lines before the period into the opening and drops lines after it', () => {
    const l = runLedger(1000, rows, '2026-10-05', '2026-10-10')
    expect(l.opening).toBe(1100)
    expect(l.rows.map((r) => r.run)).toEqual([1070, 1120])
    expect(l.closing).toBe(1120)
  })
  it('is exact with fractions', () => {
    expect(
      runLedger(
        0,
        [
          { date: 'a', delta: 0.1 },
          { date: 'b', delta: 0.2 },
        ],
        '',
        '',
      ).closing,
    ).toBe(0.3)
  })
})

describe('inRange', () => {
  it('treats empty bounds as open and both ends as inclusive', () => {
    expect(inRange('2026-10-05', '', '')).toBe(true)
    expect(inRange('2026-10-05', '2026-10-05', '2026-10-05')).toBe(true)
    expect(inRange('2026-10-04', '2026-10-05', '')).toBe(false)
    expect(inRange('2026-10-06', '', '2026-10-05')).toBe(false)
  })
})

describe('monthTotals', () => {
  it('counts and totals per month, oldest first, without floating point noise', () => {
    expect(
      monthTotals([
        { entry_date: '2026-09-17', amount: 0.1 },
        { entry_date: '2026-07-02', amount: 500 },
        { entry_date: '2026-09-28', amount: 0.2 },
      ]),
    ).toEqual([
      { month: '2026-07', count: 1, total: 500 },
      { month: '2026-09', count: 2, total: 0.3 },
    ])
  })
  it('skips rows with no usable date', () => {
    expect(monthTotals([{ entry_date: '', amount: 5 }])).toEqual([])
  })
})

describe('projectGroups', () => {
  const row = (seq: number, entry_date: string, amount: number, project: string | null) => ({
    seq,
    entry_date,
    amount,
    project: project ? { name: project } : null,
  })
  it('groups by project with a total each, rows oldest first then by number', () => {
    const g = projectGroups([
      row(3, '2026-09-19', 100, 'ب'),
      row(2, '2026-09-17', 50, 'ب'),
      row(1, '2026-09-17', 25, 'ب'),
      row(4, '2026-08-01', 7, 'أ'),
    ])
    expect(g.map((x) => [x.name, x.total])).toEqual([
      ['أ', 7],
      ['ب', 175],
    ])
    expect(g[1].rows.map((r) => r.seq)).toEqual([1, 2, 3])
  })
  it('puts a row with no project under a dash', () => {
    expect(projectGroups([row(1, '2026-01-01', 5, null)])[0].name).toBe('—')
  })
})
