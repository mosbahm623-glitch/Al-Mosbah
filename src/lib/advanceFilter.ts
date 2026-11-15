import type { Entry } from './projects'

export type ExpenseFilter = { text: string; project: string; category: string; from: string; to: string }
export const NO_EXPENSE_FILTER: ExpenseFilter = { text: '', project: '', category: '', from: '', to: '' }

export const isExpenseFiltering = (f: ExpenseFilter) => Object.values(f).some((v) => v !== '')

const clean = (s: string) => s.trim().toLowerCase()

/** The custody expenses that match every filled-in box. Text looks in the item, notes, category, project, contractor and the amount. */
export function filterExpenses(rows: readonly Entry[], f: ExpenseFilter): Entry[] {
  const q = clean(f.text)
  return rows.filter((e) => {
    if (f.project && (e.project?.name ?? '') !== f.project) return false
    if (f.category && e.category !== f.category) return false
    if (f.from && e.entry_date < f.from) return false
    if (f.to && e.entry_date > f.to) return false
    if (!q) return true
    const hay = [e.item, e.notes, e.category, e.project?.name, e.contractor?.name, String(e.amount), String(e.seq)]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

/** The distinct, sorted values of a column, for a dropdown. */
export const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b, 'ar'))
