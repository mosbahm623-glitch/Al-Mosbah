import { useMemo, useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import { mergeContractors, type ContractorRow } from '../../lib/contractors/contractors'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'

type Props = { contractors: ContractorRow[]; onClose: () => void; onSaved: () => void }

/** Admin only: ticks the names that are really one contractor, picks the name that stays, and merges the rest into it. */
export default function MergeDialog({ contractors, onClose, onSaved }: Props) {
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [keep, setKeep] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useSubmitGuard()

  const shown = useMemo(() => contractors.filter((c) => c.name.includes(q.trim())), [contractors, q])
  const chosen = contractors.filter((c) => picked.includes(c.id))
  const keepRow = chosen.find((c) => c.id === keep)
  const others = chosen.filter((c) => c.id !== keep)

  function toggle(id: string) {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))
    if (id === keep) setKeep('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void guard(send)
  }

  async function send() {
    if (!keepRow || others.length === 0) return setError('اختار اسمين على الأقل، وحدد الاسم اللي هيفضل')
    setSaving(true)
    setError(null)
    const done = await mergeContractors(
      keepRow.id,
      others.map((c) => c.id),
    )
    setSaving(false)
    if (!done) return setError('ما اتدمجش، جرّب تاني')
    onSaved()
    onClose()
  }

  return (
    <Dialog
      title="توحيد أسماء المقاولين"
      subtitle="اختار الأسماء اللي هي مقاول واحد، وبعدين الاسم اللي يفضل"
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <label className="field">
          بحث
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم" autoFocus />
        </label>
        <ul className="merge-list">
          {shown.map((c) => (
            <li key={c.id}>
              <label className="check">
                <input type="checkbox" checked={picked.includes(c.id)} onChange={() => toggle(c.id)} />
                {c.name}
              </label>
              {picked.includes(c.id) && (
                <label className="check">
                  <input type="radio" name="keep" checked={keep === c.id} onChange={() => setKeep(c.id)} />
                  الاسم اللي يفضل
                </label>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="muted">مفيش مقاول بالاسم ده</li>}
        </ul>
        {keepRow && others.length > 0 && (
          <p className="msg">
            كل قيود ومستحقات ودفعات «{others.map((c) => c.name).join('، ')}» هتتنقل لـ «{keepRow.name}»، والأسماء
            التانية هتتشال. ده مش بيترجّع.
          </p>
        )}
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving || !keepRow || others.length === 0}>
            {saving ? 'جارٍ الدمج...' : 'توحيد'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
