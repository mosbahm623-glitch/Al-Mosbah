import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import FormActions from '../../components/FormActions'
import BankLogo from '../../components/BankLogo'
import { bankBalance, saveBankTransfer, type BankSummary } from '../../lib/banks'
import { money, todayISO } from '../../lib/format'

type Props = { banks: BankSummary[]; fromId?: string; onClose: () => void; onSaved: () => void }

/** Moves money from one bank to another. */
export default function TransferDialog({ banks, fromId, onClose, onSaved }: Props) {
  const [from, setFrom] = useState(fromId ?? '')
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const source = banks.find((b) => b.id === from)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!from) return setError('اختار البنك اللي هيتحول منه')
    if (!to) return setError('اختار البنك اللي هيتحول له')
    if (from === to) return setError('اختار بنكين مختلفين')
    if (!Number.isFinite(value) || value <= 0) return setError('اكتب مبلغ أكبر من صفر')
    setSaving(true)
    setError(null)
    const { error: err } = await saveBankTransfer({
      from_bank: from,
      to_bank: to,
      amount: value,
      transfer_date: date,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  const options = (skip: string) => banks.filter((b) => b.id !== skip)

  return (
    <Dialog title="تحويل بين بنكين" onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          من بنك
          <select value={from} onChange={(e) => setFrom(e.target.value)} required autoFocus>
            <option value="">اختار البنك</option>
            {options(to).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          {source && (
            <span className="sub bank-name">
              <BankLogo logo={source.logo} name={source.name} />
              الرصيد الحالي {money(bankBalance(source))}
            </span>
          )}
        </label>
        <label className="field">
          إلى بنك
          <select value={to} onChange={(e) => setTo(e.target.value)} required>
            <option value="">اختار البنك</option>
            {options(from).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          المبلغ (ج.م)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="field">
          التاريخ
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        <label className="field">
          ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <FormActions saving={saving} onClose={onClose} />
      </form>
    </Dialog>
  )
}
