import { useState, type FormEvent } from 'react'
import { todayISO } from '../../lib/format'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import { deleteAdvanceMoney, saveAdvanceMoney, type MoneyKind } from '../../lib/advances'
import InstallmentBankField, { useInstallmentBanks } from '../../components/InstallmentBankField'

type Row = { id: string; amount: number; date: string; notes?: string | null; bankId?: string | null }

type Props = {
  advanceId: string
  holder: string
  /** installments: money handed to the holder · returns: money the holder gave back */
  kind: MoneyKind
  row?: Row
  onClose: () => void
  onSaved: () => void
}

const CONFIG = {
  installment: {
    dateColumn: 'paid_on',
    add: 'دفعة جديدة',
    edit: 'تعديل الدفعة',
    notes: false,
  },
  return: { dateColumn: 'returned_on', add: 'رد عهدة', edit: 'تعديل المرتجع', notes: true },
} as const

export default function MoneyDialog({ advanceId, holder, kind, row, onClose, onSaved }: Props) {
  const cfg = CONFIG[kind]
  const [amount, setAmount] = useState(row ? String(row.amount) : '')
  const [date, setDate] = useState(() => row?.date ?? todayISO())
  const [notes, setNotes] = useState(row?.notes ?? '')
  const banks = useInstallmentBanks()
  const [pickedBank, setPickedBank] = useState<string | null>(null)
  // an installment shows the bank it was paid from (picked by name); an old one without a bank may stay without
  const bankName = pickedBank ?? banks.list.find((b) => b.id === row?.bankId)?.name ?? ''
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    setSaving(true)
    setError(null)
    const bankId = banks.idOf(bankName)
    if (kind === 'installment' && !bankId && !(row && !row.bankId)) return setError('اختار البنك')
    const values = {
      amount: value,
      [cfg.dateColumn]: date,
      ...(cfg.notes ? { notes: notes.trim() || null } : {}),
      ...(kind === 'installment' && bankId ? { bank_id: bankId } : {}),
    }
    const { error: err } = await saveAdvanceMoney(kind, advanceId, values, row?.id)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  async function remove() {
    if (!row) return
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    const { error: err } = await deleteAdvanceMoney(kind, row.id)
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
        {kind === 'installment' && (
          <InstallmentBankField value={bankName} onChange={setPickedBank} banks={banks.list} />
        )}
        {cfg.notes && (
          <label className="field">
            ملاحظات
            <input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        )}
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
