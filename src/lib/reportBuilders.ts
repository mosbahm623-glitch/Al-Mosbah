import { isOver, percentOf, type ProjectSummary } from './projects'
import { toCents } from './money'


export type CategoryRow = { category: string; count: number; total: number; share: number }

/** Expense totals per بند, biggest first, with each بند's share of the whole (percent, one decimal). */
export function categoryTotals(rows: { category: string; amount: number }[]): CategoryRow[] {
  const map = new Map<string, { count: number; total: number }>()
  for (const r of rows) {
    const c = map.get(r.category) ?? { count: 0, total: 0 }
    c.count++
    c.total += toCents(r.amount)
    map.set(r.category, c)
  }
  const grand = [...map.values()].reduce((s, c) => s + c.total, 0)
  return [...map.entries()]
    .map(([category, c]) => ({ category, count: c.count, total: c.total / 100, share: grand > 0 ? Math.round((c.total / grand) * 1000) / 10 : 0 }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category, 'ar'))
}

export type BudgetMode = 'all' | 'near' | 'over'
export const NEAR_LIMIT = 80

/** Projects that have a budget, most used first. "near" = at least 80% used but not over; "over" = past the budget. */
export function budgetRows(projects: ProjectSummary[], mode: BudgetMode) {
  return projects
    .filter((p) => p.budget > 0)
    .map((p) => ({ p, percent: percentOf(p), over: isOver(p), remaining: (toCents(p.budget) - toCents(p.expenses)) / 100 }))
    .filter((r) => (mode === 'all' ? true : mode === 'over' ? r.over : !r.over && r.percent >= NEAR_LIMIT))
    .sort((a, b) => b.percent - a.percent || a.p.name.localeCompare(b.p.name, 'ar'))
}

/**
 * Running balance for a statement. `delta` is what the line adds to the balance (negative = takes away).
 * Everything before `from` is folded into the opening balance; lines after `to` are left out.
 * Rows must come oldest first.
 */
export function runLedger<T extends { date: string; delta: number }>(opening: number, rows: T[], from: string, to: string) {
  let run = toCents(opening)
  for (const r of rows) if (from && r.date < from) run += toCents(r.delta)
  const start = run
  const inside: (T & { run: number })[] = []
  for (const r of rows) {
    if ((from && r.date < from) || (to && r.date > to)) continue
    run += toCents(r.delta)
    inside.push({ ...r, run: run / 100 })
  }
  return { opening: start / 100, rows: inside, closing: run / 100 }
}

export const inRange = (date: string, from: string, to: string) => (!from || date >= from) && (!to || date <= to)
