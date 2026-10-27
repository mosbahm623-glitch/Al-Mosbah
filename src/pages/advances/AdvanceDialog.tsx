import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import { supabase } from '../../lib/supabase'
import type { AdvanceSummary } from '../../lib/advances'

type Props = { advance?: AdvanceSummary; onClose: () => void; onSaved: () => void }

/** Create a custody (with an optional first installment) or edit its holder / project / notes. */
export default function AdvanceDialog({ advance, onClose, onSaved }: Props) {
  const [holder, setHolder] = useState(advance?.holder_name ?? '')
  const [notes, setNotes] = useState(advance?.notes ?? '')
  const [first, setFirst] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = Number(first || 0)
    if (!holder.trim()) return setError('اكتب اسم المستلم')
    if (!Number.isFinite(amount) || amount < 0) return setError('المبلغ لازم يكون رقم صحيح')
    setSaving(true)
    setError(null)
    const row = { holder_name: holder.trim(), notes: notes.trim() || null }
    if (advance) {
      const { error: err } = await supabase.from('advances').update(row).eq('id', advance.id)
      setSaving(false)
      if (err) return setError('ما اتحفظش، جرّب تاني')
    } else {
      const { data, error: err } = await supabase.from('advances').insert(row).select('id').single()
      if (err || !data) {
        setSaving(false)
        return setError('العهدة ما اتحفظتش، جرّب تاني')
      }
      if (amount > 0) {
        const { error: instErr } = await supabase
          .from('advance_installments')
          .insert({ advance_id: data.id, amount, paid_on: date })
        if (instErr) {
          setSaving(false)
          onSaved()
          return setError('العهدة اتسجلت لكن الدفعة الأولى ما اتسجلتش، ضيفها من صفحة العهدة')
        }
      }
      setSaving(false)
    }
    onSaved()
    onClose()
  }

  return (
    <Dialog title={advance ? 'تعديل العهدة' : 'عهدة جديدة'} subtitle={advance?.holder_name} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          اسم المستلم (المهندس)
          <input value={holder} onChange={(e) => setHolder(e.target.value)} required autoFocus />
        </label>
        {!advance && (
          <div className="field-row">
            <label className="field">
              الدفعة الأولى (ج.م)
              <input value={first} onChange={(e) => setFirst(e.target.value)} inputMode="decimal" placeholder="اختياري" />
            </label>
            <label className="field">
              التاريخ
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
          </div>
        )}
        <label className="field">
          ملاحظات
          <input value={notes} onChange={(e) => setNotes(e.target.value)} />
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
