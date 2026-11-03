import { supabase } from './supabase'

export type PendingEntry = {
  id: string
  project_id: string
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
  reject_reason: string | null
  edit_reason: string | null
  invoices?: { count: number }[]
  project: { name: string } | null
  contractor: { name: string } | null
  bank: { name: string } | null
  creator: { full_name: string | null } | null
}

const COLUMNS =
  'id,project_id,seq,rev,kind,category,item,amount,entry_date,notes,advance_id,status,created_at,reject_reason,edit_reason,invoices:entry_attachments(count),project:projects(name),contractor:contractors(name),bank:bank_accounts(name),creator:profiles!entries_created_by_profile_fkey(full_name)'

export const fetchByStatus = (status: 'pending' | 'rejected') =>
  supabase
    .from('entries')
    .select(COLUMNS)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .returns<PendingEntry[]>()

/**
 * Approve or reject entries as they were shown (same rev). Returns how many went through and how many were
 * skipped because someone changed them in the meantime; those need a fresh look. A rejection carries its reason.
 */
export async function decide(items: { id: string; rev: number }[], status: 'approved' | 'rejected', reason?: string) {
  const patch = status === 'rejected' ? { status, reject_reason: reason?.trim() ?? '' } : { status }
  const results = await Promise.all(
    items.map((it) => supabase.from('entries').update(patch).eq('id', it.id).eq('rev', it.rev).select('id')),
  )
  const failed = results.some((r) => r.error)
  const done = results.filter((r) => !r.error && (r.data?.length ?? 0) > 0).length
  return { failed, done, skipped: items.length - done - results.filter((r) => r.error).length }
}

/**
 * Send an approved entry back to the approvals list. Only the status changes, so the number, the entry date and the
 * time it was recorded stay exactly as they were. Goes through only if nobody changed the entry since it was loaded.
 */
export async function reopenEntry(id: string, rev: number) {
  const { data, error } = await supabase
    .from('entries')
    .update({ status: 'pending' })
    .eq('id', id)
    .eq('rev', rev)
    .select('id')
  return !error && (data?.length ?? 0) > 0
}

/** What the approvals list can be narrowed by; an empty field does not filter. */
export type ApprovalFilter = {
  /** words that must all appear in the البيان / البند / notes */
  text: string
  /** name of the person who recorded the entry */
  who: string
  bank: string
  /** the date of the entry (YYYY-MM-DD) */
  day: string
  /** amount range, both ends included */
  min: string
  max: string
}

export const NO_FILTER: ApprovalFilter = { text: '', who: '', bank: '', day: '', min: '', max: '' }

export const isFiltering = (f: ApprovalFilter) => Object.values(f).some((v) => v.trim() !== '')

// Arabic spelling variants should not hide a match (أ/إ/آ, ى/ي, ة/ه, diacritics)
const plain = (s: string) =>
  s
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')

const bound = (v: string) => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Number(v))

export function filterEntries(rows: PendingEntry[], f: ApprovalFilter): PendingEntry[] {
  const words = plain(f.text).split(/\s+/).filter(Boolean)
  const min = bound(f.min)
  const max = bound(f.max)
  return rows.filter((e) => {
    if (words.length) {
      const hay = plain([e.item, e.category, e.notes].filter(Boolean).join(' '))
      if (!words.every((w) => hay.includes(w))) return false
    }
    if (f.who && (e.creator?.full_name ?? '') !== f.who) return false
    if (f.bank && (e.bank?.name ?? '') !== f.bank) return false
    if (f.day && e.entry_date !== f.day) return false
    if (min !== null && e.amount < min) return false
    if (max !== null && e.amount > max) return false
    return true
  })
}

/** Everything waiting for the admin: entries and custody payments (this is the number on the red badge). */
export async function countPending() {
  const [entries, payments] = await Promise.all([
    supabase.from('entries').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('advance_installments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  return (entries.count ?? 0) + (payments.count ?? 0)
}

/** A custody payment (دفعة عهدة) recorded by the owner, waiting for the admin or sent back with a reason. */
export type PendingInstallment = {
  id: string
  advance_id: string
  amount: number
  paid_on: string
  status: 'pending' | 'rejected'
  created_at: string
  reject_reason: string | null
  advance: { holder_name: string } | null
  creator: { full_name: string | null } | null
}

const INSTALLMENT_COLUMNS =
  'id,advance_id,amount,paid_on,status,created_at,reject_reason,advance:advances(holder_name),creator:profiles!advance_installments_created_by_fkey(full_name)'

export const fetchInstallmentsByStatus = (status: 'pending' | 'rejected') =>
  supabase
    .from('advance_installments')
    .select(INSTALLMENT_COLUMNS)
    .eq('status', status)
    .order('created_at', { ascending: true })
    .returns<PendingInstallment[]>()

/** Approve or reject custody payments as they were shown (still in the same status). A rejection carries its reason. */
export async function decideInstallments(
  items: { id: string; status: 'pending' | 'rejected' }[],
  status: 'approved' | 'rejected',
  reason?: string,
) {
  const patch = status === 'rejected' ? { status, reject_reason: reason?.trim() ?? '' } : { status }
  const results = await Promise.all(
    items.map((it) =>
      supabase.from('advance_installments').update(patch).eq('id', it.id).eq('status', it.status).select('id'),
    ),
  )
  const failed = results.some((r) => r.error)
  const done = results.filter((r) => !r.error && (r.data?.length ?? 0) > 0).length
  return { failed, done, skipped: items.length - done - results.filter((r) => r.error).length }
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
