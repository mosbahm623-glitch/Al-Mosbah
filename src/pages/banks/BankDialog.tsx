import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import { saveBank, type BankSummary } from '../../lib/banks'

type Props = { bank?: BankSummary; onClose: () => void; onSaved: () => void }

/** New bank / account, or rename it and change its opening balance. */
export default function BankDialog({ bank, onClose, onSaved }: Props) {
  const [name, setName] = useState(bank?.name ?? '')
  const [opening, setOpening] = useState(bank ? String(bank.opening_balance) : '0')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(opening || 0)
    if (!name.trim()) return setError('اكتب اسم البنك')
    if (!Number.isFinite(value)) return setError('الرصيد الافتتاحي لازم يكون رقم')
    setSaving(true)
    setError(null)
    const row = { name: name.trim(), opening_balance: value }
    const { error: err } = await saveBank(row, bank?.id)
    setSaving(false)
    if (err) return setError(err.code === '23505' ? 'فيه بنك بنفس الاسم' : 'ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title={bank ? 'تعديل البنك' : 'بنك جديد'} subtitle={bank?.name} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          اسم البنك / الحساب
          <input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </label>
        <label className="field">
          الرصيد الافتتاحي (ج.م)
          <input value={opening} onChange={(e) => setOpening(e.target.value)} inputMode="decimal" />
        </label>
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
