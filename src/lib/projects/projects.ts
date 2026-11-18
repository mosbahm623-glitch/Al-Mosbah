import { supabase } from '../supabase'
import { fetchPaged } from '../core/paged'
import type { ProjectType } from '../core/format'
import { ENTRY_COLUMNS, type Entry } from '../entries/entryTypes'

type BudgetRow = { id: string; name: string; budget: number; spent: number; over: boolean }

/** The numbers on the dashboard, worked out by the database. */
export type DashboardSummary = {
  total_income: number
  total_expenses: number
  total_advances: number
  advances_balance: number
  contractor_dues: number
  active_projects: number
  net_cash: number
  over_count: number
  budget_rows: BudgetRow[]
}

export type ProjectSummary = {
  id: string
  name: string
  budget: number
  status: 'active' | 'closed'
  type: ProjectType
  income: number
  /** includes custody installments (minus returns), not the entries paid from a custody */
  expenses: number
  /** expense entries not paid from a custody */
}

/** The projects a new entry may go to: the open ones, plus `keepId` (an entry already on a closed project keeps it). */
export const pickableProjects = (list: ProjectSummary[], keepId?: string | null) =>
  list.filter((p) => p.status === 'active' || p.id === keepId)

export const percentOf = (p: ProjectSummary) => (p.budget > 0 ? Math.round((p.expenses / p.budget) * 100) : 0)
export const isOver = (p: ProjectSummary) => p.budget > 0 && p.expenses > p.budget

/** Per-project totals, computed in the database (see migration 005). */
export const fetchSummaries = () => supabase.rpc('project_summaries').returns<ProjectSummary[]>()

/** The figures on the dashboard, all computed in the database. */
export const fetchDashboardSummary = () => supabase.rpc('dashboard_summary').returns<DashboardSummary>()

export type ProjectInput = { name: string; type: ProjectType; status: 'active' | 'closed'; budget: number }

/** A new project, or (with an id) an edit of an existing one. */
export const saveProject = (row: ProjectInput, id?: string) =>
  id ? supabase.from('projects').update(row).eq('id', id) : supabase.from('projects').insert(row)

/** All of a project's entries, newest first. Read page by page, because the API stops at 1000 rows per request. */
export async function fetchEntries(projectId: string): Promise<{ data: Entry[] | null; error: boolean }> {
  const data = await fetchPaged<Entry>((from, to) =>
    supabase
      .from('entries')
      .select(ENTRY_COLUMNS)
      .eq('project_id', projectId)
      .order('seq', { ascending: false })
      .order('id')
      .range(from, to)
      .returns<Entry[]>(),
  )
  return { data, error: data === null }
}
