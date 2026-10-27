import { useState, type FormEvent } from 'react'
import { todayISO } from '../../lib/format'
import Dialog from '../../components/Dialog'
import { supabase } from '../../lib/supabase'

type Row = { id: string; amount: number; date: string; notes?: string | null }

type Props = {
  advanceId: string
  holder: string
  /** installments: money handed to the holder · returns: money the holder gave back */
  kind: 'installment' | 'return'
  row?: Row
  onClose: () => void
  onSaved: () => void
}

const CONFIG = {
  installment: { table: 'advance_installments', dateColumn: 'paid_on', add: 'دفعة جديدة', edit: 'تعديل الدفعة', notes: false },
  return: { table: 'advance_returns', dateColumn: 'returned_on', add: 'رد عهدة', edit: 'تعديل المرتجع', notes: true },
} as const

export default function MoneyDialog({ advanceId, holder, kind, row, onClose, onSaved }: Props) {
  const cfg = CONFIG[kind]
  const [amount, setAmount] = useState(row ? String(row.amount) : '')
  const [date, setDate] = useState(() => row?.date ?? todayISO())
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
    const values = { amount: value, [cfg.dateColumn]: date, ...(cfg.notes ? { notes: notes.trim() || null } : {}) }
    const { error: err } = row
      ? await supabase.from(cfg.table).update(values as never).eq('id', row.id)
      : await supabase.from(cfg.table).insert({ ...values, advance_id: advanceId } as never)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  async function remove() {
    if (!row) return
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    const { error: err } = await supabase.from(cfg.table).delete().eq('id', row.id)
    setSaving(false)
    if (err) return setError('ما اتحذفش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={row ? cfg.edit : cfg.add} subtitle={holder} onClose={onClose}>
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
        {cfg.notes && (
          <label className="field">
            ملاحظات
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        )}
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          {row && (
            <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={saving}>
              {confirmDelete ? 'تأكيد الحذف نهائياً' : 'حذف'}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  )
}
