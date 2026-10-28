import type { ProjectType } from './format'
import { fetchPaged } from './paged'
import { ENTRY_COLUMNS, type Entry } from './projects'
import { supabase } from './supabase'

export type Category = { id: string; name: string; expense_items: { id: string; name: string }[] }

/** The بنود with their known بيانات (suggestions for the entry form). */
export const fetchCategories = () =>
  supabase.from('expense_categories').select('id,name,expense_items(id,name)').order('name').returns<Category[]>()

export async function createCategory(name: string) {
  const { data, error } = await supabase.from('expense_categories').insert({ name }).select('id').single()
  return !error && Boolean(data)
}

/** Remembers a بيان under its بند so it shows up as a suggestion next time. The entry does not depend on it. */
export async function rememberItem(categoryId: string, name: string) {
  await supabase.from('expense_items').insert({ name, category_id: categoryId })
}

export type EntryRow = {
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

export const insertEntry = (row: EntryRow, advanceId: string | null) =>
  supabase.from('entries').insert({ ...row, advance_id: advanceId }).select('seq')

/** Only goes through if nobody changed the entry since `rev` (an empty result means it was changed). */
export const updateEntry = (id: string, rev: number, row: EntryRow) =>
  supabase.from('entries').update(row).eq('id', id).eq('rev', rev).select('id')

/** Soft delete. `data` is false when the entry changed since `rev`. */
export const deleteEntry = (id: string, rev: number, reason: string) => supabase.rpc('delete_entry', { p_id: id, p_rev: rev, p_reason: reason })

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

export const fetchMyEntries = (userId: string) =>
  supabase
    .from('entries')
    .select('id,seq,kind,category,item,amount,entry_date,status,project:projects(name)')
    .eq('created_by', userId)
    .order('seq', { ascending: false })
    .limit(8)
    .returns<MyEntry[]>()

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

/** What was approved or rejected on one day (`YYYY-MM-DD`, the person's own clock), whatever the date of the entries themselves. */
export async function fetchDecidedEntries(day: string) {
  const from = new Date(`${day}T00:00:00`)
  const to = new Date(from)
  to.setDate(to.getDate() + 1)
  const rows = await fetchPaged<DecidedEntry>((a, b) =>
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
  return { data: rows, error: rows === null }
}

/** Entries in the given statuses, optionally only those one person recorded. */
export async function fetchEntriesByStatus(statuses: string[], creatorId: string) {
  const rows = await fetchPaged<Entry>((a, b) => {
    let q = supabase.from('entries').select(`${ENTRY_COLUMNS},project:projects(name)`).in('status', statuses)
    if (creatorId) q = q.eq('created_by', creatorId)
    return q.order('created_at').order('id').range(a, b).returns<Entry[]>()
  })
  return { data: rows, error: rows === null }
}

export type CategorySpendRow = { id: string; category: string; amount: number; project: { type: ProjectType } | null }

/** Approved expenses (with the project type) in a period, for the per-بند report. */
export async function fetchCategorySpend(from: string, to: string) {
  const rows = await fetchPaged<CategorySpendRow>((a, b) => {
    let q = supabase.from('entries').select('id,category,amount,project:projects(type)').eq('kind', 'expense').eq('status', 'approved')
    if (from) q = q.gte('entry_date', from)
    if (to) q = q.lte('entry_date', to)
    return q.order('id').range(a, b).returns<CategorySpendRow[]>()
  })
  return { data: rows, error: rows === null }
}
