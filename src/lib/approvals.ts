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
  supabase.from('entries').select(COLUMNS).eq('status', status).order('created_at', { ascending: true }).returns<PendingEntry[]>()

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
