import { useMemo, useState } from 'react'
import { Pencil, RotateCcw } from 'lucide-react'
import { restoreEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { useAuth } from '../../auth/AuthProvider'
import Segmented from '../../components/Segmented'
import { dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const

type Props = { entries: Entry[]; canEdit: boolean; onEdit: (e: Entry) => void; onRestored?: () => void }

export default function EntryList({ entries, canEdit, onEdit, onRestored }: Props) {
  const { isAdmin, isStaff } = useAuth()
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  const [category, setCategory] = useState<string | null>(null)

  async function restore(id: string) {
    if (await restoreEntry(id)) notifyApprovalsChanged()
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
            onClick={() => setCategory(null)}
          >
            الكل · {money(expenseTotal)}
          </button>
          {chips.map(([name, total]) => (
            <button
              key={name}
              type="button"
              className={`cat-chip ${category === name ? 'cat-chip-on' : ''}`}
              aria-pressed={category === name}
              onClick={() => setCategory(category === name ? null : name)}
            >
              {name} · {money(total)}
            </button>
          ))}
        </div>
      )}

      <div className="toolbar">
        <h2 className="section-title">القيود</h2>
        <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
        <span className="toolbar-note muted small">{shown.length} قيد</span>
      </div>

      {shown.length === 0 && <div className="card empty">مفيش قيود.</div>}

      {shown.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th className="sm-hide">التاريخ</th>
                  <th className="sm-hide">النوع</th>
                  <th className="sm-hide">البند</th>
                  <th>البيان</th>
                  <th className="sm-hide">المقاول</th>
                  <th className="sm-hide">البنك</th>
                  <th className="sm-hide">سجّله</th>
                  <th className="sm-hide">ملاحظات</th>
                  <th>المبلغ</th>
                  {canEdit && (
                    <th>
                      <span className="sr-only">إجراءات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id} className={e.status === 'deleted' ? 'row-deleted' : undefined}>
                    <td className="strong num">
                      #{e.seq}
                      <span className="sub">{dateText(e.entry_date)}</span>
                    </td>
                    <td className="num muted sm-hide">{dateText(e.entry_date)}</td>
                    <td className="sm-hide">
                      <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        <span className="dot" />
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                    </td>
                    <td className="sm-hide">{e.category}</td>
                    <td className="strong">
                      {e.item}
                      {e.advance_id && (
                        <>
                          {' '}
                          <span className="chip chip-neutral">من عهدة</span>
                        </>
                      )}
                      {e.status === 'pending' && (
                        <>
                          {' '}
                          <span className="chip chip-warn">قيد الموافقة</span>
                        </>
                      )}
                      {e.status === 'rejected' && (
                        <>
                          {' '}
                          <span className="chip chip-err">مرفوض</span>
                        </>
                      )}
                      {e.status === 'deleted' && (
                        <>
                          {' '}
                          <span className="chip chip-neutral">محذوف</span>
                          {e.deleteReason && <span className="small"> · السبب: {e.deleteReason}</span>}
                        </>
                      )}
                      <span className="sub">
                        {[e.category, e.contractor?.name, e.bank?.name].filter(Boolean).join(' · ')}
                      </span>
                      {e.notes && <span className="sub">{e.notes}</span>}
                      {e.creator?.full_name && <span className="sub">سجّله {e.creator.full_name}</span>}
                    </td>
                    <td className="muted sm-hide">{e.contractor?.name}</td>
                    <td className="muted sm-hide">{e.bank?.name}</td>
                    <td className="muted sm-hide">{e.creator?.full_name}</td>
                    <td className="muted sm-hide">{e.notes}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </td>
                    {canEdit && (
                      <td>
                        {e.status === 'deleted'
                          ? isAdmin && (
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
                          : (isStaff || e.status !== 'approved') && (
                              <button
                                type="button"
                                className="icon-btn"
                                aria-label={`تعديل القيد ${e.seq}`}
                                onClick={() => onEdit(e)}
                              >
                                <Pencil size={17} />
                              </button>
                            )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
