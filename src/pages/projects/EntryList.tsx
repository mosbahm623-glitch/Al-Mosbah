import { useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Pencil, RotateCcw, Undo2 } from 'lucide-react'
import { reopenEntry, restoreEntry } from '../../lib/approvals/approvals'
import { notifyApprovalsChanged } from '../../lib/core/events'
import { useAuth } from '../../auth/AuthProvider'
import InvoiceLink from '../../components/InvoiceLink'
import StatusChip, { EntryFlag } from '../../components/StatusChip'
import Pager from '../../components/Pager'
import Segmented from '../../components/Segmented'
import { dateShort, dateText, money, timeText } from '../../lib/core/format'
import { amountTone } from '../../lib/entries/entryKind'
import { AmountText, KindChip } from '../../components/EntryParts'
import type { Entry } from '../../lib/entries/entryTypes'
import { enteredByOf } from '../../lib/entries/enteredBy'
import { usePages } from '../../lib/users/usePages'
import { STATUS } from '../../lib/core/status'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const

type Props = { entries: Entry[]; canEdit: boolean; onEdit: (e: Entry) => void; onRestored?: () => void }

export default function EntryList({ entries, canEdit, onEdit, onRestored }: Props) {
  const { isAdmin, canTouch } = useAuth()
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  const [category, setCategory] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  // arrows scroll the strip; in RTL the "forward" direction is negative scrollLeft
  function scrollStrip(forward: boolean) {
    const el = stripRef.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    const step = Math.max(el.clientWidth * 0.8, 200)
    el.scrollBy({ left: (forward ? 1 : -1) * (rtl ? -1 : 1) * step, behavior: 'smooth' })
  }

  async function restore(id: string) {
    if (await restoreEntry(id)) notifyApprovalsChanged()
    onRestored?.()
  }

  async function reopen(e: Entry) {
    if (await reopenEntry(e.id, e.rev)) notifyApprovalsChanged()
    onRestored?.()
  }

  // chips: total spent per بند (expenses only), biggest first
  const chips = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of entries)
      if (e.kind === 'expense' && e.status === STATUS.approved)
        totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [entries])
  const expenseTotal = chips.reduce((s, [, v]) => s + v, 0)

  const shown = useMemo(
    () =>
      entries.filter(
        (e) => (kind === 'all' || e.kind === kind) && (!category || (e.kind === 'expense' && e.category === category)),
      ),
    [entries, kind, category],
  )
  const pager = usePages(shown)
  // the notes column only earns its space when at least one visible row has a note
  const hasNotes = shown.some((e) => e.notes)

  return (
    <>
      {chips.length > 0 && (
        <section className="panel cat-panel">
          <div className="cat-head">
            <h2 className="section-title">تصنيفات المصروفات</h2>
            <button type="button" className="btn btn-ghost" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'عرض أقل' : 'عرض الكل'}
            </button>
          </div>
          <div className="cat-strip-wrap">
            {!showAll && (
              <button
                type="button"
                className="cat-arrow"
                aria-label="السابق"
                onClick={() => scrollStrip(false)}
              >
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            )}
            <div
              ref={stripRef}
              className={`cat-strip ${showAll ? 'cat-strip-all' : ''}`}
              role="group"
              aria-label="تصفية حسب البند"
            >
              <button
                type="button"
                className={`cat-card ${category === null ? 'cat-card-on' : ''}`}
                aria-pressed={category === null}
                onClick={() => {
                  setCategory(null)
                  pager.setPage(1)
                }}
              >
                <span className="cat-name">الكل</span>
                <span className="cat-total">{money(expenseTotal)}</span>
                <span className="cat-cur">ج.م</span>
              </button>
              {chips.map(([name, total]) => (
                <button
                  key={name}
                  type="button"
                  className={`cat-card ${category === name ? 'cat-card-on' : ''}`}
                  aria-pressed={category === name}
                  onClick={() => {
                    setCategory(category === name ? null : name)
                    pager.setPage(1)
                  }}
                >
                  <span className="cat-name">{name}</span>
                  <span className="cat-total">{money(total)}</span>
                  <span className="cat-cur">ج.م</span>
                </button>
              ))}
            </div>
            {!showAll && (
              <button type="button" className="cat-arrow" aria-label="التالي" onClick={() => scrollStrip(true)}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </section>
      )}

      <div className="toolbar">
        <h2 className="section-title">القيود</h2>
        <Segmented
          label="نوع القيد"
          value={kind}
          options={KINDS}
          onChange={(k) => {
            setKind(k)
            pager.setPage(1)
          }}
        />
        <span className="toolbar-note muted small">{shown.length} قيد</span>
      </div>

      {shown.length === 0 && <div className="card empty">مفيش قيود.</div>}

      {shown.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>التاريخ</th>
                  <th className="sm-hide">النوع</th>
                  <th className="sm-hide">البند</th>
                  <th>البيان</th>
                  <th className="sm-hide">المقاول</th>
                  <th className="sm-hide">البنك</th>
                  <th className="sm-hide">سجّله</th>
                  {hasNotes && <th className="sm-hide">ملاحظات</th>}
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
                  <tr key={e.id} className={e.status === STATUS.deleted ? 'row-deleted' : undefined}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">
                      <span className="sm-hide">{dateText(e.entry_date)}</span>
                      <span className="sm-only">{dateShort(e.entry_date)}</span>
                      <span className="sub">{timeText(e.created_at)}</span>
                    </td>
                    <td className="sm-hide">
                      <KindChip entry={e} />
                    </td>
                    <td className="sm-hide">{e.category}</td>
                    <td className="strong">
                      {e.item}
                      <InvoiceLink entry={e} />
                      {e.advance_id && (
                        <>
                          {' '}
                          <span className="chip chip-neutral">من عهدة</span>
                        </>
                      )}
                      <EntryFlag status={e.status} reason={e.reject_reason} />
                      {e.status === STATUS.deleted && (
                        <>
                          {' '}
                          <StatusChip status="deleted" />
                          {e.deleteReason && <span className="small"> · السبب: {e.deleteReason}</span>}
                        </>
                      )}
                      <span className="sub">
                        {[e.category, e.contractor?.name, e.bank?.name].filter(Boolean).join(' · ')}
                      </span>
                      {e.notes && <span className="sub">{e.notes}</span>}
                      {enteredByOf(e) && <span className="sub">سجّله {enteredByOf(e)}</span>}
                    </td>
                    <td className="muted sm-hide">{e.contractor?.name}</td>
                    <td className="muted sm-hide">{e.bank?.name}</td>
                    <td className="muted sm-hide">{enteredByOf(e)}</td>
                    {hasNotes && <td className="muted sm-hide">{e.notes}</td>}
                    <td className={`num strong ${amountTone(e)}`}>
                      <AmountText entry={e} />
                    </td>
                    <td className="sm-only">{e.status !== STATUS.deleted && <StatusChip status={e.status} />}</td>
                    {canEdit && (
                      <td>
                        {e.status === STATUS.deleted ? (
                          isAdmin && (
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={`استرجاع القيد ${e.seq}`}
                              title="استرجاع"
                              onClick={() => void restore(e.id)}
                            >
                              <RotateCcw size={17} />
                            </button>
                          )
                        ) : (
                          <>
                            {canTouch(e.status) && (
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`تعديل القيد ${e.seq}`}
                                onClick={() => onEdit(e)}
                              >
                                <Pencil size={17} />
                              </button>
                            )}
                            {isAdmin && e.status === STATUS.approved && (
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`رجّع القيد ${e.seq} للموافقات`}
                                title="رجّع للموافقات"
                                onClick={() => void reopen(e)}
                              >
                                <Undo2 size={17} />
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager {...pager} onChange={pager.setPage} />
        </section>
      )}
    </>
  )
}
