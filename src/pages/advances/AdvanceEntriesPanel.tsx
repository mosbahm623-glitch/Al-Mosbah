import { useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import InvoiceLink from '../../components/InvoiceLink'
import Pager from '../../components/Pager'
import { usePages } from '../../lib/users/usePages'
import StatusChip, { EntryFlag } from '../../components/StatusChip'
import { dateShort, dateText, money, timeText } from '../../lib/core/format'
import type { Entry } from '../../lib/entries/entryTypes'
import { enteredByOf } from '../../lib/entries/enteredBy'
import {
  distinct,
  filterExpenses,
  isExpenseFiltering,
  NO_EXPENSE_FILTER,
  type ExpenseFilter,
} from '../../lib/advances/advanceFilter'
import { STATUS } from '../../lib/core/status'

type Props = {
  entries: Entry[] | null | undefined
  /** the panel heading and the message when the list is empty */
  title: string
  empty: string
  canEdit: boolean
  canTouch: (status: string) => boolean
  onSpend: () => void
  onEdit: (entry: Entry) => void
}

/** What the holder spent out of the custody. */
export default function AdvanceEntriesPanel({ entries, title, empty, canEdit, canTouch, onSpend, onEdit }: Props) {
  const [filter, setFilter] = useState<ExpenseFilter>(NO_EXPENSE_FILTER)
  const all = useMemo(() => entries ?? [], [entries])
  const shown = useMemo(() => filterExpenses(all, filter), [all, filter])
  const projectNames = useMemo(() => distinct(all.map((e) => e.project?.name)), [all])
  const categories = useMemo(() => distinct(all.map((e) => e.category)), [all])
  const setF = (patch: Partial<ExpenseFilter>) => setFilter({ ...filter, ...patch })
  const filtering = isExpenseFiltering(filter)
  const pager = usePages(shown)
  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">{title}</h2>
        {canEdit && (
          <button className="btn btn-icon" onClick={() => onSpend()}>
            <Plus size={18} aria-hidden="true" />
            مصروف من العهدة
          </button>
        )}
      </div>
      {all.length > 1 && (
        <div className="adv-filters" role="search" aria-label="فلتر المصروفات">
          <input
            type="search"
            className="adv-filter-text"
            value={filter.text}
            onChange={(e) => setF({ text: e.target.value })}
            placeholder="بحث: بيان أو مبلغ أو ملاحظة"
            aria-label="بحث في المصروفات"
          />
          <div className="adv-filter-row">
            <select aria-label="المشروع" value={filter.project} onChange={(e) => setF({ project: e.target.value })}>
              <option value="">كل المشاريع</option>
              {projectNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select aria-label="البند" value={filter.category} onChange={(e) => setF({ category: e.target.value })}>
              <option value="">كل البنود</option>
              {categories.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <details className="adv-filter-dates" open={!!(filter.from || filter.to)}>
            <summary>فلتر بالتاريخ</summary>
            <div className="adv-filter-row">
              <label>
                من
                <input type="date" value={filter.from} onChange={(e) => setF({ from: e.target.value })} />
              </label>
              <label>
                لحد
                <input type="date" value={filter.to} onChange={(e) => setF({ to: e.target.value })} />
              </label>
            </div>
          </details>
          {filtering && (
            <button type="button" className="btn btn-ghost" onClick={() => setFilter(NO_EXPENSE_FILTER)}>
              مسح الفلتر
            </button>
          )}
        </div>
      )}
      {filtering && (
        <p className="muted small" role="status">
          {shown.length} من {all.length} · الإجمالي{' '}
          <span className="num strong tone-text-err">{money(shown.reduce((t, e) => t + e.amount, 0))}</span>
        </p>
      )}
      {all.length > 0 && shown.length === 0 ? (
        <p className="empty muted">مفيش مصروفات بالفلتر ده.</p>
      ) : all.length ? (
        <div className="table-wrap">
          <table className="table wrap-desc">
            <thead>
              <tr>
                <th className="sm-hide">رقم</th>
                <th>التاريخ</th>
                <th className="sm-hide">المشروع</th>
                <th className="sm-hide">البند</th>
                <th>البيان</th>
                <th className="sm-hide">المقاول</th>
                <th className="sm-hide">ملاحظات</th>
                <th className="sm-hide">سجّله</th>
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
              {pager.items.map((e) => (
                <tr key={e.id}>
                  <td className="strong num sm-hide">#{e.seq}</td>
                  <td className="num muted">
                    <span className="sm-hide">{dateText(e.entry_date)}</span>
                    <span className="sm-only">{dateShort(e.entry_date)}</span>
                    <span className="sub">{timeText(e.created_at)}</span>
                  </td>
                  <td className="sm-hide">{e.project?.name}</td>
                  <td className="sm-hide">{e.category}</td>
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
                  <td className="muted sm-hide">{e.contractor?.name}</td>
                  <td className="muted sm-hide">{e.notes}</td>
                  <td className="muted sm-hide">{enteredByOf(e)}</td>
                  <td className="num strong tone-text-err">−{money(e.amount)}</td>
                  <td className="sm-only">{e.status !== STATUS.deleted && <StatusChip status={e.status} />}</td>
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
        <p className="empty muted">{empty}</p>
      )}
      <Pager {...pager} onChange={pager.setPage} />
    </section>
  )
}
