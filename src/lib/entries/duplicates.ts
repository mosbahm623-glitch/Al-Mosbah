import { supabase } from '../supabase'

export type DuplicateGroup = {
  entry_date: string
  kind: 'income' | 'expense'
  amount: number
  category: string
  item: string | null
  project: string | null
  n: number
  entries: { seq: number; status: string }[]
}

/** Admin only: groups of entries with the same day, kind, البند, البيان, project and amount. */
export const fetchDuplicateGroups = () => supabase.rpc('duplicate_entry_groups').returns<DuplicateGroup[]>()

/** The money that would stay if only one entry of each group were real. */
export const extraAmount = (g: Pick<DuplicateGroup, 'n' | 'amount'>) => (g.n - 1) * g.amount

/** Two entries typed one right after the other: the likeliest double save. */
export const isConsecutivePair = (g: Pick<DuplicateGroup, 'entries'>) =>
  g.entries.length === 2 && g.entries[1].seq - g.entries[0].seq <= 3

export function summarizeDuplicates(groups: DuplicateGroup[]) {
  const income = groups.filter((g) => g.kind === 'income')
  const expense = groups.filter((g) => g.kind === 'expense')
  const sum = (list: DuplicateGroup[]) => list.reduce((s, g) => s + extraAmount(g), 0)
  return {
    groups: groups.length,
    extraEntries: groups.reduce((s, g) => s + g.n - 1, 0),
    extraIncome: sum(income),
    extraExpense: sum(expense),
    consecutive: groups.filter(isConsecutivePair).length,
  }
}
