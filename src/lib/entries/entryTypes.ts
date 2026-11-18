import { type EntryStatus } from '../core/status'

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
  /** when the entry was recorded (never changes, even if it is sent back to approvals) */
  created_at?: string
  notes: string | null
  /** set when the entry was paid from a custody */
  advance_id: string | null
  creator?: { full_name: string | null } | null
  /** المدخل as typed in for entries copied from the old system (no profile) */
  entered_by_name?: string | null
  /** pending entries (made by non-admins) are listed but not counted until an admin approves them */
  status: EntryStatus
  /** how many invoice photos are attached (embedded count) */
  invoices?: { count: number }[]
  /** why the entry was last edited (kept for good in the entry history) */
  edit_reason?: string | null
  /** why the admin rejected the entry (rejected entries only) */
  reject_reason?: string | null
  /** why a deleted entry was deleted (deleted entries only) */
  deleteReason?: string | null
  /** only loaded where entries of several projects are listed (custody page) */
  project?: { name: string } | null
  project_id?: string
}

export const ENTRY_COLUMNS =
  'id,seq,rev,kind,category,item,amount,entry_date,created_at,notes,advance_id,status,reject_reason,edit_reason,invoices:entry_attachments(count),contractor:contractors(name),bank:bank_accounts(name),entered_by_name,creator:profiles!entries_created_by_profile_fkey(full_name)'
