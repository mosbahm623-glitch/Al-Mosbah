import { useCallback } from 'react'
import { fetchEntryHistory } from '../lib/entries'
import { money } from '../lib/format'
import { ENTRY_STATUS_LABEL as STATUS, HISTORY_ACTION_LABEL as ACTION } from '../lib/labels'
import { useAsync } from '../lib/useAsync'

type Snapshot = Record<string, unknown> | null
type Change = { id: number; action: string; old_row: Snapshot; new_row: Snapshot; changed_at: string; changed_by_name: string | null }

const FIELDS: [string, string][] = [['category', 'البند'], ['item', 'البيان'], ['amount', 'المبلغ'], ['entry_date', 'التاريخ'], ['notes', 'ملاحظات'], ['status', 'الحالة'], ['delete_reason', 'سبب المسح']]

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
  const { data, failed } = useAsync<Change[]>(useCallback(() => fetchEntryHistory(entryId), [entryId]))
  if (failed) return <p className="muted small span-2">مقدرناش نحمّل سجل التعديلات</p>
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
