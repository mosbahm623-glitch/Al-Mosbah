import { supabase } from './supabase'
import type { ProjectType } from './format'

export type ProjectSummary = {
  id: string
  name: string
  budget: number
  status: 'active' | 'closed'
  type: ProjectType
  income: number
  expenses: number
}

export type Entry = {
  id: string
  seq: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  contractor: { name: string } | null
  amount: number
  entry_date: string
  notes: string | null
}

export const percentOf = (p: ProjectSummary) => (p.budget > 0 ? Math.round((p.expenses / p.budget) * 100) : 0)
export const isOver = (p: ProjectSummary) => p.budget > 0 && p.expenses > p.budget

/** Per-project totals, computed in the database (see migration 005). */
export const fetchSummaries = () => supabase.rpc('project_summaries')

export const fetchEntries = (projectId: string) =>
  supabase
    .from('entries')
    .select('id,seq,kind,category,item,amount,entry_date,notes,contractor:contractors(name)')
    .eq('project_id', projectId)
    .order('seq', { ascending: false })
    .returns<Entry[]>()
