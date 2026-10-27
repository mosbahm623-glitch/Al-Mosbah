import { useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Segmented from '../../components/Segmented'
import { dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const

type Props = { entries: Entry[]; canEdit: boolean; onEdit: (e: Entry) => void }

export default function EntryList({ entries, canEdit, onEdit }: Props) {
  const isAdmin = useAuth().profile?.role === 'admin'
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  const [category, setCategory] = useState<string | null>(null)

  // chips: total spent per بند (expenses only), biggest first
  const chips = useMemo(() => {
    const totals = new Map<string, number>()
    for (const e of entries) if (e.kind === 'expense' && e.status === 'approved') totals.set(e.category, (totals.get(e.category) ?? 0) + e.amount)
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
          <button type="button" className={`cat-chip ${category === null ? 'cat-chip-on' : ''}`} aria-pressed={category === null} onClick={() => setCategory(null)}>
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
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>البند</th>
                  <th>اسم المصروف</th>
                  <th>المقاول</th>
                  <th>البنك</th>
                  <th>ملاحظات</th>
                  <th>المبلغ</th>
                  {canEdit && <th><span className="sr-only">إجراءات</span></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">{dateText(e.entry_date)}</td>
                    <td>
                      <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        <span className="dot" />
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                    </td>
                    <td>{e.category}</td>
                    <td className="strong">{e.item}
                      {e.advance_id && <> <span className="chip chip-neutral">من عهدة</span></>}
                      {e.status === 'pending' && <> <span className="chip chip-warn">قيد الموافقة</span></>}
                      {e.status === 'rejected' && <> <span className="chip chip-err">مرفوض</span></>}
                    </td>
                    <td className="muted">{e.contractor?.name}</td>
                    <td className="muted">{e.bank?.name}</td>
                    <td className="muted">{e.notes}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </td>
                    {canEdit && (
                      <td>
                        {(isAdmin || e.status !== 'approved') && (
                          <button type="button" className="icon-btn" aria-label={`تعديل القيد ${e.seq}`} onClick={() => onEdit(e)}>
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
