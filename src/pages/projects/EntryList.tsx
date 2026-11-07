import { useMemo, useState } from 'react'
import { Pencil, RotateCcw, Undo2 } from 'lucide-react'
import { reopenEntry, restoreEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { useAuth } from '../../auth/AuthProvider'
import InvoiceLink from '../../components/InvoiceLink'
import StatusChip, { EntryFlag } from '../../components/StatusChip'
import Segmented from '../../components/Segmented'
import { dateShort, dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'
import { enteredByOf } from '../../lib/enteredBy'

const PAGE = 60

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
  const [limit, setLimit] = useState(PAGE)

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
      if (e.kind === 'expense' && e.status === 'approved')
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

  return (
    <>
      {chips.length > 0 && (
        <div className="chips-row" role="group" aria-label="تصفية حسب البند">
          <button
            type="button"
            className={`cat-chip ${category === null ? 'cat-chip-on' : ''}`}
            aria-pressed={category === null}
            onClick={() => {
              setCategory(null)
              setLimit(PAGE)
            }}
          >
            الكل · {money(expenseTotal)}
          </button>
          {chips.map(([name, total]) => (
            <button
              key={name}
              type="button"
              className={`cat-chip ${category === name ? 'cat-chip-on' : ''}`}
              aria-pressed={category === name}
              onClick={() => {
                setCategory(category === name ? null : name)
                setLimit(PAGE)
              }}
            >
              {name} · {money(total)}
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <h2 className="section-title">القيود</h2>
        <Segmented
          label="نوع القيد"
          value={kind}
          options={KINDS}
          onChange={(k) => {
            setKind(k)
            setLimit(PAGE)
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
                  <th className="sm-hide">ملاحظات</th>
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
                {shown.slice(0, limit).map((e) => (
                  <tr key={e.id} className={e.status === 'deleted' ? 'row-deleted' : undefined}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">
                      <span className="sm-hide">{dateText(e.entry_date)}</span>
                      <span className="sm-only">{dateShort(e.entry_date)}</span>
                    </td>
                    <td className="sm-hide">
                      <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        <span className="dot" />
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
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
                      {e.status === 'deleted' && (
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
                    <td className="muted sm-hide">{e.notes}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </td>
                    <td className="sm-only">{e.status !== 'deleted' && <StatusChip status={e.status} />}</td>
                    {canEdit && (
                      <td>
                        {e.status === 'deleted' ? (
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
                            {isAdmin && e.status === 'approved' && (
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
          {shown.length > limit && (
            <div className="more-row">
              <button type="button" className="btn btn-ghost" onClick={() => setLimit((n) => n + PAGE)}>
                عرض المزيد ({shown.length - limit})
              </button>
            </div>
          )}
        </section>
      )}
    </>
  )
}
