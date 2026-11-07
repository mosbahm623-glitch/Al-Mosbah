import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import AdvanceEntryFilters from './AdvanceEntryFilters'
import { NO_ENTRY_FILTER, enteredByOf, filterAdvanceEntries, isEntryFiltering } from '../../lib/advanceEntryFilter'
import InvoiceLink from '../../components/InvoiceLink'
import StatusChip, { EntryFlag } from '../../components/StatusChip'
import { dateShort, dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'

type Props = {
  entries: Entry[] | null | undefined
  canEdit: boolean
  canTouch: (status: string) => boolean
  onSpend: () => void
  onEdit: (entry: Entry) => void
}

/** What the holder spent out of the custody. */
export default function AdvanceEntriesPanel({ entries, canEdit, canTouch, onSpend, onEdit }: Props) {
  const [filter, setFilter] = useState(NO_ENTRY_FILTER)
  const [cols, setCols] = useState({ project: true, category: true, contractor: true, enteredBy: true, notes: true })
  const all = useMemo(() => entries ?? [], [entries])
  const rows = useMemo(() => filterAdvanceEntries(all, filter), [all, filter])
  const total = rows.reduce((s, e) => s + (e.status === 'approved' ? e.amount : 0), 0)
  const toggle = (k: keyof typeof cols) => setCols((c) => ({ ...c, [k]: !c[k] }))
  const COLS: [keyof typeof cols, string][] = [
    ['project', 'المشروع'],
    ['category', 'البند'],
    ['contractor', 'المقاول'],
    ['enteredBy', 'المدخل'],
    ['notes', 'الملاحظات'],
  ]
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">المصروفات من العهدة</h2>
        {canEdit && (
          <button className="btn btn-icon" onClick={() => onSpend()}>
            <Plus size={18} aria-hidden="true" />
            مصروف من العهدة
          </button>
        )}
      </div>
      {all.length > 0 && (
        <>
          <AdvanceEntryFilters rows={all} filter={filter} onChange={setFilter} />
          <fieldset className="check-row sm-hide">
            <legend className="sr-only">أعمدة الجدول</legend>
            {COLS.map(([k, label]) => (
              <label className="check" key={k}>
                <input type="checkbox" checked={cols[k]} onChange={() => toggle(k)} />
                {label}
              </label>
            ))}
          </fieldset>
          <p className="muted small">
            {rows.length} قيد{isEntryFiltering(filter) ? ` من ${all.length}` : ''} · إجمالي المعتمد:{' '}
            <b>{money(total)}</b>
          </p>
        </>
      )}
      {all.length > 0 && rows.length === 0 && <p className="empty muted">مفيش قيود بالفلتر ده.</p>}
      {rows.length > 0 ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>رقم</th>
                <th>التاريخ</th>
                {cols.project && <th className="sm-hide">المشروع</th>}
                {cols.category && <th className="sm-hide">البند</th>}
                <th>البيان</th>
                {cols.contractor && <th className="sm-hide">المقاول</th>}
                {cols.notes && <th className="sm-hide">ملاحظات</th>}
                {cols.enteredBy && <th className="sm-hide">المدخل</th>}
                <th>المبلغ</th>
                <th className="sm-only">الحالة</th>
                {canEdit && (
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id}>
                  <td className="strong num">#{e.seq}</td>
                  <td className="num muted">
                    <span className="sm-hide">{dateText(e.entry_date)}</span>
                    <span className="sm-only">{dateShort(e.entry_date)}</span>
                  </td>
                  {cols.project && <td className="sm-hide">{e.project?.name}</td>}
                  {cols.category && <td className="sm-hide">{e.category}</td>}
                  <td className="strong">
                    {e.item}
                    <InvoiceLink entry={e} />
                    <EntryFlag status={e.status} reason={e.reject_reason} />
                    {e.project?.name && <span className="sub-line">{e.project?.name}</span>}
                    <span className="sub">
                      {[e.category, e.project?.name, e.contractor?.name].filter(Boolean).join(' · ')}
                    </span>
                    {e.notes && <span className="sub">{e.notes}</span>}
                    {enteredByOf(e) && <span className="sub">سجّله {enteredByOf(e)}</span>}
                  </td>
                  {cols.contractor && <td className="muted sm-hide">{e.contractor?.name}</td>}
                  {cols.notes && <td className="muted sm-hide">{e.notes}</td>}
                  {cols.enteredBy && <td className="muted sm-hide">{enteredByOf(e)}</td>}
                  <td className="num strong tone-text-err">−{money(e.amount)}</td>
                  <td className="sm-only">{e.status !== 'deleted' && <StatusChip status={e.status} />}</td>
                  {canEdit && (
                    <td>
                      {canTouch(e.status) && (
                        <button className="icon-btn" aria-label={`تعديل القيد ${e.seq}`} onClick={() => onEdit(e)}>
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty muted">مفيش مصروفات من العهدة لسه.</p>
      )}
    </section>
  )
}
