import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import { deleteContractorTxn, saveContractorTxn, type LedgerTxn } from '../../lib/contractors'
import { todayISO } from '../../lib/format'
import type { Named } from '../../lib/lookups'

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
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
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
    )
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  async function remove() {
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
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required autoFocus />
          </label>
          <label className="field">
            التاريخ
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
        </div>
        <label className="field">
          المشروع (اختياري)
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">من غير مشروع</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
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
