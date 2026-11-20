import { useMemo, useState, type FormEvent } from 'react'
import { todayISO, money } from '../../lib/core/format'
import Dialog from '../../components/Dialog'
import SearchSelect from '../../components/SearchSelect'
import { useAsync } from '../../lib/core/useAsync'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'
import {
  advanceBalance,
  fetchAdvanceSummaries,
  transferBetweenAdvances,
  type AdvanceSummary,
} from '../../lib/advances/advances'

type Props = { fromId: string; fromName: string; fromBalance: number; onClose: () => void; onSaved: () => void }

/** Moves money from this custody to another: a return here and a payment there, saved together and linked. */
export default function TransferDialog({ fromId, fromName, fromBalance, onClose, onSaved }: Props) {
  const all = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const [to, setTo] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useSubmitGuard()

  const others = useMemo(
    () => (all.data ?? []).filter((a) => a.id !== fromId && a.status === 'open'),
    [all.data, fromId],
  )
  const names = useMemo(() => others.map((a) => a.holder_name), [others])
  const target = others.find((a) => a.holder_name === to)

  function submit(e: FormEvent) {
    e.preventDefault()
    void guard(send)
  }

  async function send() {
    const value = Number(amount)
    if (!target) return setError('اختار العهدة اللي هتتحول لها')
    if (!Number.isFinite(value) || value === 0) return setError('اكتب المبلغ')
    setSaving(true)
    setError(null)
    // a negative amount moves the money the other way: from the picked custody into this one
    const [src, dst] = value > 0 ? [fromId, target.id] : [target.id, fromId]
    const { error: err } = await transferBetweenAdvances(src, dst, Math.abs(value), date, notes.trim() || null)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  const value = Number(amount)
  const over = Number.isFinite(value) && value > fromBalance

  return (
    <Dialog title="تحويل لعهدة تانية" subtitle={`من عهدة ${fromName} · رصيدها ${money(fromBalance)}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <SearchSelect label="إلى عهدة" value={to} options={names} placeholder="ابحث عن العهدة" onChange={setTo} />
        {target && <p className="muted">رصيدها دلوقتي {money(advanceBalance(target))}</p>}
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
          ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        {value < 0 && target && (
          <p className="muted">
            مبلغ بالسالب: {money(-value)} هيتحول من عهدة {target.holder_name} إلى عهدة {fromName}
          </p>
        )}
        {over && <p className="msg msg-error">المبلغ أكبر من رصيد العهدة، رصيدها هيبقى بالسالب</p>}
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving || !target}>
            {saving ? 'جارٍ الحفظ...' : 'تحويل'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
