import { isOver, type ProjectSummary } from './projects'
import type { ProjectType } from './format'

export type StatusFilter = 'all' | 'active' | 'closed'
export type TypeFilter = 'all' | ProjectType

export type ProjectTotals = {
  count: number
  budget: number
  income: number
  expenses: number
  balance: number
  /** projects whose expenses went past their budget */
  over: number
}

// sums are done in piasters so 0.1 + 0.2 never shows up as 0.30000000000000004
const cents = (n: number) => Math.round(n * 100)

export const balanceOf = (p: Pick<ProjectSummary, 'income' | 'expenses'>) => (cents(p.income) - cents(p.expenses)) / 100

export function totalsOf(rows: ProjectSummary[]): ProjectTotals {
  let budget = 0
  let income = 0
  let expenses = 0
  let over = 0
  for (const p of rows) {
    budget += cents(p.budget)
    income += cents(p.income)
    expenses += cents(p.expenses)
    if (isOver(p)) over++
  }
  return { count: rows.length, budget: budget / 100, income: income / 100, expenses: expenses / 100, balance: (income - expenses) / 100, over }
}

export const filterProjects = (rows: ProjectSummary[], status: StatusFilter, type: TypeFilter) =>
  rows.filter((p) => (status === 'all' || p.status === status) && (type === 'all' || p.type === type))
