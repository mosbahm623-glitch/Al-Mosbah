import { supabase } from './supabase'
import type { ProjectType } from './format'
import { fetchPaged } from './paged'
import { ENTRY_COLUMNS, type Entry } from './projects'

/** What an entry form saves, for a new entry and for an edit alike. */
type Snapshot = Record<string, unknown> | null

/** One line of an entry's history: who changed what and when (admin only). */
export type EntryChange = {
  id: number
  action: string
  old_row: Snapshot
  new_row: Snapshot
  changed_at: string
  changed_by_name: string | null
}

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

/**
 * Saves an edit through the database function, which refuses it without a reason and keeps the reason in the entry
 * history. Saves only if nobody changed the entry since it was shown (same `rev`); `data` is false when they did.
 */
export const updateEntry = (id: string, rev: number, row: EntryInput, reason: string) =>
  supabase.rpc('edit_entry', { p_id: id, p_rev: rev, p_reason: reason.trim(), p_row: row })

/**
 * A new entry, optionally paid out of a custody (عهدة). Returns its id and number. The id is chosen here, so sending
 * the same entry twice (a lost answer, a retry from the offline queue) fails on the id instead of making a duplicate.
 */
export const insertEntry = (row: EntryInput, advanceId: string | null, id: string = crypto.randomUUID()) =>
  supabase
    .from('entries')
    .insert({ id, ...row, advance_id: advanceId })
    .select('id,seq')

/** Soft delete with a reason; false in `data` means the entry changed meanwhile. */
export const deleteEntry = (id: string, rev: number, reason: string) =>
  supabase.rpc('delete_entry', { p_id: id, p_rev: rev, p_reason: reason })

/** Admin only: who did what to this entry, oldest first. */
export const fetchEntryHistory = (entryId: string) =>
  supabase.rpc('entry_history_of', { p_id: entryId }).returns<EntryChange[]>()

export type MyEntry = Entry

/** The last 8 entries one person recorded. */
export const fetchMyEntries = (userId: string) =>
  supabase
    .from('entries')
    .select(`${ENTRY_COLUMNS},project_id,project:projects(name)`)
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
  bank: { name: string } | null
  creator: { full_name: string | null } | null
  decider: { full_name: string | null } | null
}

const DECIDED_COLUMNS =
  'id,seq,kind,category,item,amount,entry_date,status,decided_at,project:projects(name),contractor:contractors(name),bank:bank_accounts(name),creator:profiles!entries_created_by_profile_fkey(full_name),decider:profiles!entries_decided_by_fkey(full_name)'

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

export type ExpenseRow = {
  id: string
  category: string
  amount: number
  project: { type: ProjectType; name: string } | null
  contractor: { name: string } | null
  bank: { name: string } | null
}

/** Approved expenses in a period (open ends allowed), with the type of their project. Null on failure. */
export const fetchApprovedExpenses = (from: string, to: string) =>
  fetchPaged<ExpenseRow>((a, b) => {
    let q = supabase
      .from('entries')
      .select('id,category,amount,project:projects(type,name),contractor:contractors(name),bank:bank_accounts(name)')
      .eq('kind', 'expense')
      .eq('status', 'approved')
    if (from) q = q.gte('entry_date', from)
    if (to) q = q.lte('entry_date', to)
    return q.order('id').range(a, b).returns<ExpenseRow[]>()
  })
