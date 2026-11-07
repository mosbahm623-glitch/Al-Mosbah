import { useMemo, useState } from 'react'
import { Pencil, Plus, Undo2 } from 'lucide-react'
import Segmented from '../../components/Segmented'
import DataGrid from '../../components/DataGrid'
import InvoiceLink from '../../components/InvoiceLink'
import {
  MOVE_LABEL,
  NO_ENTRY_FILTER,
  buildMoves,
  enteredByOf,
  filterMoves,
  isEntryFiltering,
  totalsOfMoves,
  type Move,
  type MoveFilter,
} from '../../lib/advanceEntryFilter'
import type { AdvanceReturn, Installment } from '../../lib/advances'
import { money } from '../../lib/format'
import type { Cell, Col, Section } from '../../lib/tableTypes'
import type { Entry } from '../../lib/projects'
import AdvanceEntryFilters from './AdvanceEntryFilters'

type Props = {
  installments: Installment[] | null | undefined
  entries: Entry[] | null | undefined
  returns: AdvanceReturn[] | null | undefined
  /** admin or owner: may record payments and returns (the owner's payments wait for the admin) */
  isStaff: boolean
  /** only the admin may change a payment that is already approved */
  isAdmin: boolean
  canEdit: boolean
  canTouch: (status: string) => boolean
  onAddInstallment: () => void
  onEditInstallment: (row: Installment) => void
  onSpend: () => void
  onEditEntry: (entry: Entry) => void
  onAddReturn: () => void
  onEditReturn: (row: AdvanceReturn) => void
}

const KINDS: { value: MoveFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'in', label: 'وارد (دفعات)' },
  { value: 'out', label: 'مصروف' },
  { value: 'back', label: 'مرتجع' },
]

const COLS = [
  ['project', 'المشروع'],
  ['category', 'البند'],
  ['contractor', 'المقاول'],
  ['enteredBy', 'المدخل'],
  ['notes', 'الملاحظات'],
] as const

/** Everything that moved on one custody (payments in, expenses, returns) in one table, with filters. */
export default function AdvanceMovementsPanel(p: Props) {
  const [kind, setKind] = useState<MoveFilter>('all')
  const [filter, setFilter] = useState(NO_ENTRY_FILTER)
  const [cols, setCols] = useState({ project: true, category: true, contractor: true, enteredBy: true, notes: true })
  const entries = useMemo(() => p.entries ?? [], [p.entries])
  const moves = useMemo(
    () => buildMoves(p.installments ?? [], entries, p.returns ?? []),
    [p.installments, entries, p.returns],
  )
  const shown = useMemo(() => filterMoves(moves, kind, filter), [moves, kind, filter])
  const t = totalsOfMoves(shown)
  const entryFields = kind === 'all' || kind === 'out'
  const showCols = entryFields
    ? cols
    : { ...cols, project: false, category: false, contractor: false, enteredBy: false }
  const filtering = isEntryFiltering(filter) || kind !== 'all'

  const pickKind = (k: MoveFilter) => {
    setKind(k)
    // fields that do not fit the new kind must not keep filtering invisibly
    if (k === 'in' || k === 'back') setFilter((f) => ({ ...f, project: '', category: '', contractor: '', who: '' }))
  }

  const cells: Col[] = [
    { h: 'التاريخ', kind: 'date' },
    { h: 'النوع' },
    { h: 'رقم', kind: 'int' },
    { h: 'البيان' },
    ...(showCols.category ? [{ h: 'البند' }] : []),
    ...(showCols.project ? [{ h: 'المشروع' }] : []),
    ...(showCols.contractor ? [{ h: 'المقاول' }] : []),
    ...(showCols.enteredBy ? [{ h: 'المدخل' }] : []),
    ...(showCols.notes ? [{ h: 'ملاحظات' }] : []),
    { h: 'المبلغ', kind: 'money' },
  ]
  const rowOf = (m: Move): Cell[] => {
    const optional = (e: Entry | null, notes: string | null): Cell[] => [
      ...(showCols.category ? [e?.category ?? null] : []),
      ...(showCols.project ? [e?.project?.name ?? null] : []),
      ...(showCols.contractor ? [e?.contractor?.name ?? null] : []),
      ...(showCols.enteredBy ? [e ? enteredByOf(e) : null] : []),
      ...(showCols.notes ? [notes] : []),
    ]
    if (m.type === 'in') {
      const state = m.row.status === 'pending' ? ' (مستنية الموافقة)' : m.row.status === 'rejected' ? ' (مرفوضة)' : ''
      return [m.date, MOVE_LABEL.in + state, null, 'دفعة مستلمة', ...optional(null, m.row.reject_reason), m.amount]
    }
    if (m.type === 'back') return [m.date, MOVE_LABEL.back, null, 'رد عهدة', ...optional(null, m.row.notes), -m.amount]
    const e = m.row
    const state = e.status === 'pending' ? ' (مستنية الموافقة)' : e.status === 'rejected' ? ' (مرفوض)' : ''
    return [m.date, MOVE_LABEL.out + state, e.seq, e.item, ...optional(e, e.notes), -e.amount]
  }
  const section: Section = { cols: cells, rows: shown.map(rowOf) }
  const actions = (i: number) => {
    const m = shown[i]
    if (m.type === 'out')
      return (
        <>
          <InvoiceLink entry={m.row} />
          {p.canEdit && p.canTouch(m.row.status) && (
            <button className="icon-btn" aria-label={`تعديل القيد ${m.row.seq}`} onClick={() => p.onEditEntry(m.row)}>
              <Pencil size={16} aria-hidden="true" />
            </button>
          )}
        </>
      )
    if (!p.isStaff) return null
    const edit =
      m.type === 'in'
        ? (p.isAdmin || m.row.status !== 'approved') && (() => p.onEditInstallment(m.row))
        : () => p.onEditReturn(m.row)
    return edit ? (
      <button className="icon-btn" aria-label={m.type === 'in' ? 'تعديل الدفعة' : 'تعديل المرتجع'} onClick={edit}>
        <Pencil size={16} aria-hidden="true" />
      </button>
    ) : null
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">حركة العهدة</h2>
        <div className="head-actions">
          {p.isStaff && (
            <button className="btn btn-icon" onClick={() => p.onAddInstallment()}>
              <Plus size={18} aria-hidden="true" />
              دفعة جديدة
            </button>
          )}
          {p.canEdit && (
            <button className="btn btn-icon" onClick={() => p.onSpend()}>
              <Plus size={18} aria-hidden="true" />
              مصروف من العهدة
            </button>
          )}
          {p.isStaff && (
            <button className="btn btn-ghost btn-icon" onClick={() => p.onAddReturn()}>
              <Undo2 size={18} aria-hidden="true" />
              رد عهدة
            </button>
          )}
        </div>
      </div>

      {moves.length > 0 && (
        <div className="reports-layout adv-layout">
          <aside className="ctl" aria-label="فلتر حركة العهدة">
            <Segmented label="نوع الحركة" value={kind} options={KINDS} onChange={pickKind} />
            <AdvanceEntryFilters rows={entries} filter={filter} onChange={setFilter} entryFields={entryFields} />
            {entryFields && (
              <fieldset className="cols">
                <legend>أعمدة الجدول</legend>
                {COLS.map(([k, label]) => (
                  <label className="check" key={k}>
                    <input type="checkbox" checked={cols[k]} onChange={() => setCols((c) => ({ ...c, [k]: !c[k] }))} />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}
          </aside>
          <div className="reports-preview">
            <p className="muted small panel-note">
              {shown.length} حركة{filtering ? ` من ${moves.length}` : ''}
              {t.in > 0 && (
                <>
                  {' '}
                  · وارد: <b>{money(t.in)}</b>
                </>
              )}
              {t.out > 0 && (
                <>
                  {' '}
                  · مصروف: <b>{money(t.out)}</b>
                </>
              )}
              {t.back > 0 && (
                <>
                  {' '}
                  · مرتجع: <b>{money(t.back)}</b>
                </>
              )}
            </p>
            {shown.length === 0 ? (
              <p className="empty muted">مفيش حركات بالفلتر ده.</p>
            ) : (
              <DataGrid section={section} actions={actions} />
            )}
          </div>
        </div>
      )}
      {moves.length === 0 && <p className="empty muted">مفيش حركات على العهدة لسه.</p>}
    </section>
  )
}
