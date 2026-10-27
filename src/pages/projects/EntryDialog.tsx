import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import { supabase } from '../../lib/supabase'

const KINDS = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'وارد' },
] as const

type Props = { projectId: string; projectName: string; categories: string[]; onClose: () => void; onSaved: () => void }

export default function EntryDialog({ projectId, projectName, categories, onClose, onSaved }: Props) {
  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    if (!category.trim()) return setError('اكتب التصنيف')
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('entries').insert({
      project_id: projectId,
      kind,
      category: category.trim(),
      amount: value,
      entry_date: date,
      notes: notes.trim() || null,
    })
    setSaving(false)
    if (err) return setError('القيد ما اتحفظش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog title="قيد جديد" subtitle={projectName} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field">
          النوع
          <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
        </div>
        <label className="field">
          التصنيف
          <input value={category} onChange={(e) => setCategory(e.target.value)} list="entry-categories" required autoFocus />
          <datalist id="entry-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <div className="field-row">
          <label className="field">
            المبلغ (ج.م)
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" required />
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
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ القيد'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
