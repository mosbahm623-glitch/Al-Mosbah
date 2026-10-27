import { supabase } from './supabase'

export type PendingEntry = {
  id: string
  seq: number
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
  'id,seq,kind,category,item,amount,entry_date,notes,advance_id,status,created_at,project:projects(name),contractor:contractors(name),bank:bank_accounts(name),creator:profiles!entries_created_by_profile_fkey(full_name)'

export const fetchByStatus = (status: 'pending' | 'rejected') =>
  supabase.from('entries').select(COLUMNS).eq('status', status).order('created_at', { ascending: true }).returns<PendingEntry[]>()

export const decide = (ids: string[], status: 'approved' | 'rejected') =>
  supabase.from('entries').update({ status }).in('id', ids)

export const APPROVALS_CHANGED = 'approvals-changed'
export const notifyApprovalsChanged = () => window.dispatchEvent(new Event(APPROVALS_CHANGED))

export async function countPending() {
  const { count } = await supabase.from('entries').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  return count ?? 0
}
