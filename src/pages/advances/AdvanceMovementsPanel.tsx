import { useMemo, useState } from 'react'
import { Pencil, Plus, Undo2 } from 'lucide-react'
import Segmented from '../../components/Segmented'
import InvoiceLink from '../../components/InvoiceLink'
import StatusChip, { EntryFlag, RejectReason } from '../../components/StatusChip'
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
import { dateShort, dateText, money } from '../../lib/format'
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
        <>
          <div className="panel-note">
            <Segmented label="نوع الحركة" value={kind} options={KINDS} onChange={pickKind} />
          </div>
          <AdvanceEntryFilters rows={entries} filter={filter} onChange={setFilter} entryFields={entryFields} />
          {entryFields && (
            <fieldset className="check-row sm-hide">
              <legend className="sr-only">أعمدة الجدول</legend>
              {COLS.map(([k, label]) => (
                <label className="check" key={k}>
                  <input type="checkbox" checked={cols[k]} onChange={() => setCols((c) => ({ ...c, [k]: !c[k] }))} />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
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
        </>
      )}

      {moves.length === 0 && <p className="empty muted">مفيش حركات على العهدة لسه.</p>}
      {moves.length > 0 && shown.length === 0 && <p className="empty muted">مفيش حركات بالفلتر ده.</p>}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>النوع</th>
                <th>البيان</th>
                {showCols.category && <th className="sm-hide">البند</th>}
                {showCols.project && <th className="sm-hide">المشروع</th>}
                {showCols.contractor && <th className="sm-hide">المقاول</th>}
                {showCols.enteredBy && <th className="sm-hide">المدخل</th>}
                {showCols.notes && <th className="sm-hide">ملاحظات</th>}
                <th>المبلغ</th>
                {(p.isStaff || p.canEdit) && (
                  <th>
                    <span className="sr-only">إجراءات</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <MoveRow key={m.key} m={m} cols={showCols} p={p} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

type ColsShown = { project: boolean; category: boolean; contractor: boolean; enteredBy: boolean; notes: boolean }

function MoveRow({ m, cols, p }: { m: Move; cols: ColsShown; p: Props }) {
  const date = (
    <td className="num muted">
      <span className="sm-hide">{dateText(m.date)}</span>
      <span className="sm-only">{dateShort(m.date)}</span>
    </td>
  )
  if (m.type === 'in') {
    const i = m.row
    return (
      <tr>
        {date}
        <td>
          {MOVE_LABEL.in} {i.status !== 'approved' && <StatusChip status={i.status} kind="payment" />}
          {i.status === 'rejected' && <RejectReason reason={i.reject_reason} prefix="السبب" />}
        </td>
        <td className="strong">دفعة مستلمة</td>
        <Blank cols={cols} />
        <td className="num strong tone-text-ok">+{money(i.amount)}</td>
        {(p.isStaff || p.canEdit) && (
          <td>
            {p.isStaff && (p.isAdmin || i.status !== 'approved') && (
              <button className="icon-btn" aria-label="تعديل الدفعة" onClick={() => p.onEditInstallment(i)}>
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
          </td>
        )}
      </tr>
    )
  }
  if (m.type === 'back') {
    const r = m.row
    return (
      <tr>
        {date}
        <td>{MOVE_LABEL.back}</td>
        <td className="strong">رد عهدة</td>
        <Blank cols={cols} notes={r.notes} />
        <td className="num strong">−{money(r.amount)}</td>
        {(p.isStaff || p.canEdit) && (
          <td>
            {p.isStaff && (
              <button className="icon-btn" aria-label="تعديل المرتجع" onClick={() => p.onEditReturn(r)}>
                <Pencil size={16} aria-hidden="true" />
              </button>
            )}
          </td>
        )}
      </tr>
    )
  }
  const e = m.row
  return (
    <tr>
      {date}
      <td>
        {MOVE_LABEL.out} <span className="muted num">#{e.seq}</span>
        {e.status !== 'approved' && e.status !== 'deleted' && <StatusChip status={e.status} />}
      </td>
      <td className="strong">
        {e.item}
        <InvoiceLink entry={e} />
        <EntryFlag status={e.status} reason={e.reject_reason} />
        <span className="sub">{[e.category, e.project?.name, e.contractor?.name].filter(Boolean).join(' · ')}</span>
        {e.notes && <span className="sub">{e.notes}</span>}
        {enteredByOf(e) && <span className="sub">سجّله {enteredByOf(e)}</span>}
      </td>
      {cols.category && <td className="sm-hide">{e.category}</td>}
      {cols.project && <td className="sm-hide">{e.project?.name}</td>}
      {cols.contractor && <td className="muted sm-hide">{e.contractor?.name}</td>}
      {cols.enteredBy && <td className="muted sm-hide">{enteredByOf(e)}</td>}
      {cols.notes && <td className="muted sm-hide">{e.notes}</td>}
      <td className="num strong tone-text-err">−{money(e.amount)}</td>
      {(p.isStaff || p.canEdit) && (
        <td>
          {p.canEdit && p.canTouch(e.status) && (
            <button className="icon-btn" aria-label={`تعديل القيد ${e.seq}`} onClick={() => p.onEditEntry(e)}>
              <Pencil size={16} aria-hidden="true" />
            </button>
          )}
        </td>
      )}
    </tr>
  )
}

/** the cells of the optional columns for a line that has no project, category, contractor or entrant */
function Blank({ cols, notes = null }: { cols: ColsShown; notes?: string | null }) {
  return (
    <>
      {cols.category && <td className="sm-hide" />}
      {cols.project && <td className="sm-hide" />}
      {cols.contractor && <td className="sm-hide" />}
      {cols.enteredBy && <td className="sm-hide" />}
      {cols.notes && <td className="muted sm-hide">{notes}</td>}
    </>
  )
}
