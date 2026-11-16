import { useState, type FormEvent } from 'react'
import InstallmentBankField, { useInstallmentBanks } from './InstallmentBankField'
import { addInstallment, fetchAdvanceSummaries, type AdvanceSummary } from '../lib/advances'
import { money, todayISO } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const fetchOpenAdvances = async () => {
  const { data, error } = await fetchAdvanceSummaries()
  return { data: (data ?? []).filter((a) => a.status === 'open'), error }
}

/** Owner only: hand money to a custody holder from the quick page. The payment waits for the admin's approval. */
export default function AdvancePaymentForm() {
  const advances = useAsync<AdvanceSummary[]>(fetchOpenAdvances)
  const [advanceId, setAdvanceId] = useState('')
  const banks = useInstallmentBanks()
  const [bankName, setBankName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!advanceId) return setError('اختار العهدة')
    const bankId = banks.idOf(bankName)
    if (!bankId) return setError('اختار البنك')
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    setSaving(true)
    setError(null)
    setDone(null)
    const { error: err } = await addInstallment(advanceId, value, date, bankId)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    const holder = advances.data?.find((a) => a.id === advanceId)?.holder_name ?? ''
    setDone(`اتسجلت دفعة ${money(value)} لـ ${holder} — مستنّية موافقة الأدمن`)
    setAmount('')
    setBankName('')
    advances.reload()
  }

  return (
    <section className="panel quick-form">
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field span-2">
          العهدة
          <select value={advanceId} onChange={(e) => setAdvanceId(e.target.value)} required>
            <option value="">اختار العهدة</option>
            {advances.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.holder_name}
              </option>
            ))}
          </select>
        </label>
        <div className="span-2">
          <InstallmentBankField value={bankName} onChange={setBankName} banks={banks.list} />
        </div>
        <label className="field">
          المبلغ (ج.م)
          <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="field">
          التاريخ
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {(advances.failed || banks.failed) && (
          <p className="msg msg-error span-2">مقدرناش نحمّل العهد أو البنوك، جرّب تاني</p>
        )}
        {error && <p className="msg msg-error span-2">{error}</p>}
        {done && <p className="msg msg-ok span-2">{done}</p>}
        <div className="dialog-actions span-2">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ الدفعة'}
          </button>
        </div>
      </form>
    </section>
  )
}
