import { supabase } from './supabase'
import type { ProjectType } from './format'
import { fetchPaged } from './paged'
import { ENTRY_COLUMNS, type Entry } from './projects'

/** What an entry form saves, for a new entry and for an edit alike. */
export type EntryInput = {
  project_id: string
  kind: 'income' | 'expense'
  category: string
  item: string | null
  contractor_id: string | null
  bank_id: string | null
  amount: number
  entry_date: string
  notes: string | null
}

/** Saves an edit only if nobody changed the entry since it was shown (same `rev`). Returns the updated ids. */
export const updateEntry = (id: string, rev: number, row: EntryInput) =>
  supabase.from('entries').update(row).eq('id', id).eq('rev', rev).select('id')

/** A new entry, optionally paid out of a custody (عهدة). Returns its number. */
export const insertEntry = (row: EntryInput, advanceId: string | null) =>
  supabase
    .from('entries')
    .insert({ ...row, advance_id: advanceId })
    .select('seq')

/** Soft delete with a reason; false in `data` means the entry changed meanwhile. */
export const deleteEntry = (id: string, rev: number, reason: string) =>
  supabase.rpc('delete_entry', { p_id: id, p_rev: rev, p_reason: reason })

/** Admin only: who did what to this entry, oldest first. */
export const fetchEntryHistory = (entryId: string) => supabase.rpc('entry_history_of', { p_id: entryId })

export type MyEntry = {
  id: string
  seq: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
  entry_date: string
  status: string
  project: { name: string } | null
}

/** The last 8 entries one person recorded. */
export const fetchMyEntries = (userId: string) =>
  supabase
    .from('entries')
    .select('id,seq,kind,category,item,amount,entry_date,status,project:projects(name)')
    .eq('created_by', userId)
    .order('seq', { ascending: false })
    .limit(8)
    .returns<MyEntry[]>()

/** Entries in the given statuses (oldest recorded first), optionally only those one person recorded. Null on failure. */
export const fetchEntriesByStatus = (statuses: string[], creatorId: string) =>
  fetchPaged<Entry>((a, b) => {
    let q = supabase.from('entries').select(`${ENTRY_COLUMNS},project:projects(name)`).in('status', statuses)
    if (creatorId) q = q.eq('created_by', creatorId)
    return q.order('created_at').order('id').range(a, b).returns<Entry[]>()
  })

export type DecidedEntry = {
  id: string
  seq: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
  entry_date: string
  status: 'approved' | 'rejected'
  decided_at: string
  project: { name: string } | null
  contractor: { name: string } | null
  creator: { full_name: string | null } | null
  decider: { full_name: string | null } | null
}

const DECIDED_COLUMNS =
  'id,seq,kind,category,item,amount,entry_date,status,decided_at,project:projects(name),contractor:contractors(name),creator:profiles!entries_created_by_profile_fkey(full_name),decider:profiles!entries_decided_by_fkey(full_name)'

/** What was approved or rejected on one day (YYYY-MM-DD, by the person's own clock). Null on failure. */
export function fetchDecidedOn(day: string) {
  const from = new Date(`${day}T00:00:00`)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  return fetchPaged<DecidedEntry>((a, b) =>
    supabase
      .from('entries')
      .select(DECIDED_COLUMNS)
      .in('status', ['approved', 'rejected'])
      .gte('decided_at', from.toISOString())
      .lt('decided_at', to.toISOString())
      .order('decided_at')
      .order('id')
      .range(a, b)
      .returns<DecidedEntry[]>(),
  )
}

export type ExpenseRow = { id: string; category: string; amount: number; project: { type: ProjectType } | null }

/** Approved expenses in a period (open ends allowed), with the type of their project. Null on failure. */
export const fetchApprovedExpenses = (from: string, to: string) =>
  fetchPaged<ExpenseRow>((a, b) => {
    let q = supabase
      .from('entries')
      .select('id,category,amount,project:projects(type)')
      .eq('kind', 'expense')
      .eq('status', 'approved')
    if (from) q = q.gte('entry_date', from)
    if (to) q = q.lte('entry_date', to)
    return q.order('id').range(a, b).returns<ExpenseRow[]>()
  })
