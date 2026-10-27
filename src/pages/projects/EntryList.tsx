import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, Pencil } from 'lucide-react'
import Segmented from '../../components/Segmented'
import Progress from '../../components/Progress'
import { dateText, money } from '../../lib/format'
import type { Entry } from './types'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const
const VIEWS = [
  { value: 'grouped', label: 'حسب البند' },
  { value: 'table', label: 'جدول' },
] as const

const INCOME_GROUP = 'الوارد'

type Group = { name: string; income: boolean; rows: Entry[]; total: number }

type Props = { entries: Entry[]; isAdmin: boolean; onEdit: (e: Entry) => void }

function EditButton({ e, onEdit }: { e: Entry; onEdit: (e: Entry) => void }) {
  return (
    <button type="button" className="icon-btn" aria-label={`تعديل القيد ${e.seq}`} onClick={() => onEdit(e)}>
      <Pencil size={17} />
    </button>
  )
}

export default function EntryList({ entries, isAdmin, onEdit }: Props) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('grouped')
  const [focus, setFocus] = useState<string | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())

  const shown = useMemo(() => entries.filter((e) => kind === 'all' || e.kind === kind), [entries, kind])

  const groups = useMemo(() => {
    const map = new Map<string, Group>()
    for (const e of shown) {
      const income = e.kind === 'income'
      const name = income ? INCOME_GROUP : e.category
      const g = map.get(name) ?? { name, income, rows: [], total: 0 }
      g.rows.push(e)
      g.total += e.amount
      map.set(name, g)
    }
    return [...map.values()].sort((a, b) => Number(b.income) - Number(a.income) || b.total - a.total)
  }, [shown])

  const expenseGroups = groups.filter((g) => !g.income)
  const expenseTotal = expenseGroups.reduce((s, g) => s + g.total, 0)
  const visible = focus ? groups.filter((g) => g.name === focus) : groups

  function toggle(name: string) {
    setClosed((prev) => {
      const next = new Set(prev)
      if (!next.delete(name)) next.add(name)
      return next
    })
  }

  return (
    <>
      {view === 'grouped' && expenseGroups.length > 1 && (
        <section className="cat-cards" aria-label="إجمالي كل بند">
          {expenseGroups.map((g) => {
            const pct = expenseTotal > 0 ? Math.round((g.total / expenseTotal) * 100) : 0
            return (
              <button
                key={g.name}
                type="button"
                className={`cat-card ${focus === g.name ? 'cat-card-on' : ''}`}
                aria-pressed={focus === g.name}
                onClick={() => setFocus(focus === g.name ? null : g.name)}
              >
                <span className="cat-card-top">
                  <b>{g.name}</b>
                  <span className="muted small">{pct}%</span>
                </span>
                <span className="num strong">{money(g.total)}</span>
                <Progress percent={pct} over={false} />
              </button>
            )
          })}
        </section>
      )}

      <div className="toolbar">
        <h2 className="section-title">القيود</h2>
        <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
        <Segmented label="طريقة العرض" value={view} options={VIEWS} onChange={setView} />
        <span className="toolbar-note muted small">{shown.length} قيد</span>
      </div>

      {shown.length === 0 && <div className="card empty">مفيش قيود.</div>}

      {shown.length > 0 && view === 'grouped' && (
        <div className="groups">
          {visible.map((g) => {
            const open = !closed.has(g.name)
            return (
              <section key={g.name} className="panel group">
                <button type="button" className="group-head" aria-expanded={open} onClick={() => toggle(g.name)}>
                  <span className="group-name strong">{g.name}</span>
                  <span className="muted small">{g.rows.length} قيد</span>
                  <span className={`group-total num strong ${g.income ? 'tone-text-ok' : 'tone-text-err'}`}>{money(g.total)} ج.م</span>
                  {open ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}
                </button>
                {open && (
                  <ul className="rows">
                    {g.rows.map((e) => (
                      <li key={e.id} className="row">
                        <span className="row-seq muted num">#{e.seq}</span>
                        <span className="row-main">
                          <span className="strong">{g.income ? e.category : e.item}</span>
                          <span className="muted small">
                            {dateText(e.entry_date)}
                            {e.contractor ? ` · ${e.contractor.name}` : ''}
                            {e.notes ? ` · ${e.notes}` : ''}
                          </span>
                        </span>
                        <span className={`row-amount num strong ${g.income ? 'tone-text-ok' : 'tone-text-err'}`}>
                          {g.income ? '+' : '−'}
                          {money(e.amount)}
                        </span>
                        {isAdmin && <EditButton e={e} onEdit={onEdit} />}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {shown.length > 0 && view === 'table' && (
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
                  <th>ملاحظات</th>
                  <th>المبلغ</th>
                  {isAdmin && <th><span className="sr-only">إجراءات</span></th>}
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
                    <td>{e.item}</td>
                    <td>{e.contractor?.name}</td>
                    <td className="muted">{e.notes}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </td>
                    {isAdmin && (
                      <td>
                        <EditButton e={e} onEdit={onEdit} />
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
