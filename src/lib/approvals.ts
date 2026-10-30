import { supabase } from './supabase'

export type PendingEntry = {
  id: string
  seq: number
  rev: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
  entry_date: string
  notes: string | null
  advance_id: string | null
  status: 'pending' | 'rejected'
  created_at: string
  project: { name: string } | null
  contractor: { name: string } | null
  bank: { name: string } | null
  creator: { full_name: string | null } | null
}

const COLUMNS =
  'id,seq,rev,kind,category,item,amount,entry_date,notes,advance_id,status,created_at,project:projects(name),contractor:contractors(name),bank:bank_accounts(name),creator:profiles!entries_created_by_profile_fkey(full_name)'

export const fetchByStatus = (status: 'pending' | 'rejected') =>
  supabase
    .from('entries')
    .select(COLUMNS)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .returns<PendingEntry[]>()

/**
 * Approve or reject entries as they were shown (same rev). Returns how many went through and how many were
 * skipped because someone changed them in the meantime; those need a fresh look.
 */
export async function decide(items: { id: string; rev: number }[], status: 'approved' | 'rejected') {
  const results = await Promise.all(
    items.map((it) => supabase.from('entries').update({ status }).eq('id', it.id).eq('rev', it.rev).select('id')),
  )
  const failed = results.some((r) => r.error)
  const done = results.filter((r) => !r.error && (r.data?.length ?? 0) > 0).length
  return { failed, done, skipped: items.length - done - results.filter((r) => r.error).length }
}

export async function countPending() {
  const { count } = await supabase.from('entries').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}

export type DeletedEntry = {
  id: string
  seq: number
  rev: number
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
  entry_date: string
  notes: string | null
  status_before_delete: string | null
  deleted_at: string
  delete_reason: string | null
  project: string | null
  contractor: string | null
  deleted_by_name: string | null
  created_by_name: string | null
}

export const fetchDeleted = () => supabase.rpc('deleted_entries')

export async function restoreEntry(id: string) {
  const { data, error } = await supabase.rpc('restore_entry', { p_id: id })
  return !error && data === true
}

export const fetchProjectDeleted = (projectId: string) =>
  supabase.rpc('project_deleted_entries', { p_project: projectId })
