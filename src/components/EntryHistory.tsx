import { useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { money } from '../lib/format'
import { useAsync } from '../lib/useAsync'

type Snapshot = Record<string, unknown> | null
type Change = { id: number; action: string; old_row: Snapshot; new_row: Snapshot; changed_at: string; changed_by_name: string | null }

const ACTION: Record<string, string> = { edit: 'تعديل', approve: 'موافقة', reject: 'رفض', delete: 'مسح', restore: 'استرجاع', hard_delete: 'مسح نهائي' }
const STATUS: Record<string, string> = { pending: 'مستنّي موافقة', approved: 'معتمد', rejected: 'مرفوض', deleted: 'محذوف' }
const FIELDS: [string, string][] = [['category', 'البند'], ['item', 'البيان'], ['amount', 'المبلغ'], ['entry_date', 'التاريخ'], ['notes', 'ملاحظات'], ['status', 'الحالة']]

const show = (key: string, v: unknown) => {
  if (v == null || v === '') return '—'
  if (key === 'amount') return money(Number(v))
  if (key === 'status') return STATUS[String(v)] ?? String(v)
  return String(v)
}

const diff = (c: Change) =>
  c.old_row && c.new_row
    ? FIELDS.filter(([k]) => c.old_row![k] !== c.new_row![k]).map(([k, label]) => `${label}: ${show(k, c.old_row![k])} ← ${show(k, c.new_row![k])}`)
    : []

/** Admin only: who did what to this entry, oldest first. */
export default function EntryHistory({ entryId }: { entryId: string }) {
  const { data } = useAsync<Change[]>(useCallback(() => supabase.rpc('entry_history_of', { p_id: entryId }), [entryId]))
  if (!data || data.length === 0) return null
  return (
    <details className="span-2 entry-history">
      <summary>سجل القيد ({data.length})</summary>
      <ul>
        {data.map((c) => (
          <li key={c.id}>
            <strong>{ACTION[c.action] ?? c.action}</strong> · {c.changed_by_name ?? '—'} ·{' '}
            <span className="muted small">{new Date(c.changed_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            {diff(c).map((d) => (
              <div key={d} className="muted small">{d}</div>
            ))}
          </li>
        ))}
      </ul>
    </details>
  )
}
