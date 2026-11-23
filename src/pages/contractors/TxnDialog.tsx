import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import { deleteContractorTxn, itemsTotal, saveContractorTxn, type LedgerTxn } from '../../lib/contractors/contractors'
import { todayISO } from '../../lib/core/format'
import type { Named } from '../../lib/core/lookups'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'

type Props = {
  contractorId: string
  name: string
  kind: 'due' | 'payment'
  projects: Named[]
  row?: LedgerTxn
  /** project preselected for a new line */
  project?: string
  onClose: () => void
  onSaved: () => void
}

const TITLE = {
  due: { add: 'مستحق جديد', edit: 'تعديل المستحق' },
  payment: { add: 'تسجيل دفعة', edit: 'تعديل الدفعة' },
} as const

export default function TxnDialog({ contractorId, name, kind, projects, row, project, onClose, onSaved }: Props) {
  const [amount, setAmount] = useState(row ? String(row.amount) : '')
  const [date, setDate] = useState(() => row?.txn_date ?? todayISO())
  const [projectId, setProjectId] = useState(row?.project_id ?? project ?? '')
  const [notes, setNotes] = useState(row?.notes ?? '')
  const [rows, setRows] = useState<{ item: string; category: string; amount: string }[]>(() =>
    (row?.items ?? [])
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ item: i.item, category: i.category ?? '', amount: String(i.amount) })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useSubmitGuard()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function submit(e: FormEvent) {
    e.preventDefault()
    void guard(send)
  }

  /** an old line saved before projects were required may stay without one */
  const legacy = !!row && !row.project_id
  const split = kind === 'due' && rows.length > 0
  const rowsTotal = itemsTotal(rows.map((r) => ({ amount: Number(r.amount) || 0 })))

  async function send() {
    if (!projectId && !legacy) return setError('اختار المشروع، حساب المقاول بيتسجل على مشروع')
    const value = split ? rowsTotal : Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    if (split && rows.some((r) => !r.item.trim() || !(Number(r.amount) > 0)))
      return setError('كل بند محتاج بيان ومبلغ أكبر من صفر')
    setSaving(true)
    setError(null)
    const { error: err } = await saveContractorTxn(
      {
        contractor_id: contractorId,
        kind,
        amount: value,
        txn_date: date,
        project_id: projectId || null,
        notes: notes.trim() || null,
      },
      row?.id,
      kind === 'due'
        ? rows.map((r) => ({ item: r.item.trim(), category: r.category.trim() || null, amount: Number(r.amount) }))
        : undefined,
    )
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  function remove() {
    void guard(removeNow)
  }

  async function removeNow() {
    if (!row) return
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    const { error: err } = await deleteContractorTxn(row.id)
    setSaving(false)
    if (err) return setError('ما اتحذفش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={row ? TITLE[kind].edit : TITLE[kind].add} subtitle={name} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field-row">
          <label className="field">
            المبلغ (ج.م)
            <input
              value={split ? String(rowsTotal) : amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              readOnly={split}
              required
              autoFocus
            />
          </label>
          <label className="field">
            التاريخ
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          المشروع
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)} required={!legacy}>
            <option value="">{legacy ? 'من غير مشروع' : 'اختار المشروع'}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {kind === 'due' && (
          <div className="field">
            تفصيل الأعمال (اختياري)
            {rows.map((r, i) => (
              <div
                key={i}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginBottom: '0.6rem' }}
              >
                <input
                  style={{ gridColumn: '1 / -1' }}
                  aria-label="البيان"
                  placeholder="البيان"
                  value={r.item}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))}
                />
                <input
                  aria-label="البند"
                  placeholder="البند"
                  value={r.category}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))}
                />
                <input
                  aria-label="المبلغ"
                  placeholder="المبلغ"
                  inputMode="decimal"
                  value={r.amount}
                  onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  aria-label="حذف البند"
                  onClick={() => setRows(rows.filter((_, j) => j !== i))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                if (!rows.length && Number(amount) > 0) return setRows([{ item: notes.trim(), category: '', amount }])
                setRows([...rows, { item: '', category: '', amount: '' }])
              }}
            >
              ＋ بند شغل
            </button>
            {split && <span className="muted small">المبلغ = مجموع البنود، ومش بيدخل في مصروف المشروع.</span>}
          </div>
        )}
        <label className="field">
          ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <FormActions
          saving={saving}
          onClose={onClose}
          onDelete={row ? () => void remove() : undefined}
          confirmingDelete={confirmDelete}
        />
      </form>
    </Dialog>
  )
}
