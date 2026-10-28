import { supabase } from './supabase'
import type { ProjectType } from './format'

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

export type Entry = {
  id: string
  seq: number
  /** change counter: a save only goes through if nobody changed the entry since it was loaded */
  rev: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  contractor: { name: string } | null
  bank: { name: string } | null
  amount: number
  entry_date: string
  notes: string | null
  /** set when the entry was paid from a custody */
  advance_id: string | null
  creator?: { full_name: string | null } | null
  /** pending entries (made by non-admins) are listed but not counted until an admin approves them */
  status: 'pending' | 'approved' | 'rejected' | 'deleted'
  /** why a deleted entry was deleted (deleted entries only) */
  deleteReason?: string | null
  /** only loaded where entries of several projects are listed (custody page) */
  project?: { name: string } | null
  project_id?: string
}

export const percentOf = (p: ProjectSummary) => (p.budget > 0 ? Math.round((p.expenses / p.budget) * 100) : 0)
export const isOver = (p: ProjectSummary) => p.budget > 0 && p.expenses > p.budget

/** Per-project totals, computed in the database (see migration 005). */
export const fetchSummaries = () => supabase.rpc('project_summaries')

export const ENTRY_COLUMNS = 'id,seq,rev,kind,category,item,amount,entry_date,notes,advance_id,status,contractor:contractors(name),bank:bank_accounts(name),creator:profiles!entries_created_by_profile_fkey(full_name)'

export const fetchEntries = (projectId: string) =>
  supabase
    .from('entries')
    .select(ENTRY_COLUMNS)
    .eq('project_id', projectId)
    .order('seq', { ascending: false })
    .returns<Entry[]>()
