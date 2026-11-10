import { Pencil, Plus } from 'lucide-react'
import InvoiceLink from '../../components/InvoiceLink'
import Pager from '../../components/Pager'
import { usePages } from '../../lib/usePages'
import StatusChip, { EntryFlag } from '../../components/StatusChip'
import { dateShort, dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'
import { enteredByOf } from '../../lib/enteredBy'

type Props = {
  entries: Entry[] | null | undefined
  canEdit: boolean
  canTouch: (status: string) => boolean
  onSpend: () => void
  onEdit: (entry: Entry) => void
}

/** What the holder spent out of the custody. */
export default function AdvanceEntriesPanel({ entries, canEdit, canTouch, onSpend, onEdit }: Props) {
  const pager = usePages(entries ?? [])
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
      {entries?.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>رقم</th>
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
                  <td className="strong num">#{e.seq}</td>
                  <td className="num muted">
                    <span className="sm-hide">{dateText(e.entry_date)}</span>
                    <span className="sm-only">{dateShort(e.entry_date)}</span>
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
      <Pager {...pager} onChange={pager.setPage} />
    </section>
  )
}
