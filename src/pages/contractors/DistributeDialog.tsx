import { useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import { money } from '../../lib/core/format'
import { toCents } from '../../lib/core/money'
import { useAsync } from '../../lib/core/useAsync'
import { useSubmitGuard } from '../../lib/core/useSubmitGuard'
import { fetchCategories, type Category } from '../../lib/entries/catalog'
import { distributePayments, type WorkItem } from '../../lib/contractors/distribution'

type Props = {
  contractorId: string
  name: string
  projectId: string
  projectName: string
  /** the chosen payments (ids) and how much of them is still free to spread */
  entryIds: string[]
  available: number
  onClose: () => void
  onSaved: () => void
}

type Line = { item: string; category: string; amount: string }

/** Spreads the chosen payments over the work the contractor did. Saving needs the work total to fit the payments. */
export default function DistributeDialog({
  contractorId,
  name,
  projectId,
  projectName,
  entryIds,
  available,
  onClose,
  onSaved,
}: Props) {
  const categories = useAsync<Category[]>(fetchCategories)
  const [lines, setLines] = useState<Line[]>([{ item: '', category: '', amount: '' }])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useSubmitGuard()

  const total = lines.reduce((s, l) => s + (toCents(Number(l.amount)) || 0), 0) / 100
  const left = (toCents(available) - toCents(total)) / 100
  const over = left < 0
  const set = (i: number, patch: Partial<Line>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  function submit(e: FormEvent) {
    e.preventDefault()
    void guard(send)
  }

  async function send() {
    if (lines.some((l) => !l.item.trim() || !l.category || !(Number(l.amount) > 0)))
      return setError('كل شغلة محتاجة بيان وبند ومبلغ أكبر من صفر')
    if (over) return setError('مجموع الأعمال أكبر من الدفعات المختارة')
    setSaving(true)
    setError(null)
    const items: WorkItem[] = lines.map((l) => ({
      item: l.item.trim(),
      category: l.category,
      amount: Number(l.amount),
    }))
    const { error: err } = await distributePayments(projectId, contractorId, entryIds, items)
    setSaving(false)
    if (err) return setError('ما اتحفظش، جرّب تاني (ممكن حد وزّع نفس الدفعات قبلك)')
    onSaved()
    onClose()
  }

  return (
    <Dialog title="وزّع الدفعات على أعمال" subtitle={`${name} — ${projectName}`} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <p className="muted small">
          الدفعات المختارة: <strong>{money(available)}</strong> ج.م. القيود نفسها مش بتتغيّر (النقدية والبنوك زي ما هي)،
          وتقارير البنود هتعرض الأعمال دي بدل الدفعات.
        </p>
        {lines.map((l, i) => (
          <div
            key={i}
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.5rem', marginBottom: '0.6rem' }}
          >
            <input
              style={{ gridColumn: '1 / -1' }}
              aria-label="البيان"
              placeholder="البيان (الشغلة)"
              value={l.item}
              onChange={(e) => set(i, { item: e.target.value })}
            />
            <select aria-label="البند" value={l.category} onChange={(e) => set(i, { category: e.target.value })}>
              <option value="">البند</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label="المبلغ"
              placeholder="المبلغ"
              inputMode="decimal"
              value={l.amount}
              onChange={(e) => set(i, { amount: e.target.value })}
            />
            {lines.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost"
                aria-label="حذف الشغلة"
                onClick={() => setLines(lines.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setLines([...lines, { item: '', category: '', amount: '' }])}
        >
          ＋ شغلة
        </button>
        <p className={over ? 'msg msg-error' : 'muted small'}>
          مجموع الأعمال: {money(total)} —{' '}
          {over ? `زيادة ${money(-left)} عن الدفعات` : `الباقي تحت الحساب: ${money(left)}`}
        </p>
        {error && <p className="msg msg-error">{error}</p>}
        <div className="dialog-actions">
          <button className="btn" disabled={saving || over || total <= 0}>
            {saving ? 'جارٍ الحفظ...' : 'حفظ التوزيع'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Dialog>
  )
}
