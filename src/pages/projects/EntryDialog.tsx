import { useCallback, useMemo, useState, type FormEvent } from 'react'
import Dialog from '../../components/Dialog'
import Segmented from '../../components/Segmented'
import CreatableSelect from '../../components/CreatableSelect'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'

const KINDS = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'وارد' },
] as const

type Category = { id: string; name: string; expense_items: { id: string; name: string }[] }
type Contractor = { id: string; name: string }

type Props = { projectId: string; projectName: string; onClose: () => void; onSaved: () => void }

export default function EntryDialog({ projectId, projectName, onClose, onSaved }: Props) {
  const fetchCategories = useCallback(
    () => supabase.from('expense_categories').select('id,name,expense_items(id,name)').order('name'),
    [],
  )
  const fetchContractors = useCallback(() => supabase.from('contractors').select('id,name').order('name'), [])
  const categories = useAsync<Category[]>(fetchCategories)
  const contractors = useAsync<Contractor[]>(fetchContractors)

  const [kind, setKind] = useState<'income' | 'expense'>('expense')
  const [categoryId, setCategoryId] = useState('')
  const [itemName, setItemName] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [incomeLabel, setIncomeLabel] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'))
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const category = categories.data?.find((c) => c.id === categoryId)
  const categoryOptions = useMemo(() => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })), [categories.data])

  async function createCategory(name: string) {
    const { data, error: err } = await supabase.from('expense_categories').insert({ name }).select('id').single()
    if (err || !data) return null
    categories.reload()
    return data.id as string
  }

  async function findOrCreateContractor(name: string) {
    const existing = contractors.data?.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const { data, error: err } = await supabase.from('contractors').insert({ name }).select('id').single()
    return err || !data ? null : (data.id as string)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    const isExpense = kind === 'expense'
    if (isExpense && !category) return setError('اختار البند')
    if (isExpense && !itemName.trim()) return setError('اكتب اسم المصروف')
    if (!isExpense && !incomeLabel.trim()) return setError('اكتب بيان الوارد')
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    setSaving(true)
    setError(null)
    let contractorId: string | null = null
    if (isExpense && contractorName.trim()) {
      contractorId = await findOrCreateContractor(contractorName.trim())
      if (!contractorId) {
        setSaving(false)
        return setError('ما قدرناش نحفظ اسم المقاول، جرّب تاني')
      }
    }
    if (isExpense && category && !category.expense_items.some((i) => i.name === itemName.trim())) {
      // remember the name so it shows up as a suggestion next time; the entry does not depend on it
      await supabase.from('expense_items').insert({ name: itemName.trim(), category_id: category.id })
    }
    const { error: err } = await supabase.from('entries').insert({
      project_id: projectId,
      kind,
      category: isExpense ? category!.name : incomeLabel.trim(),
      item: isExpense ? itemName.trim() : null,
      contractor_id: contractorId,
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
    <Dialog title="قيد جديد" subtitle={projectName} wide onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        <div className="field span-2">
          النوع
          <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
        </div>

        {kind === 'expense' ? (
          <>
            <CreatableSelect
              label="البند"
              value={categoryId}
              options={categoryOptions}
              placeholder="اختار البند"
              required
              onChange={(v) => {
                setCategoryId(v)
                setItemName('')
              }}
              onCreate={createCategory}
            />
            <label className="field">
              اسم المصروف
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                list="item-names"
                placeholder={categoryId ? 'اكتب اسم المصروف' : 'اختار البند الأول'}
                disabled={!categoryId}
                required
              />
              <datalist id="item-names">
                {category?.expense_items.map((i) => <option key={i.id} value={i.name} />)}
              </datalist>
            </label>
            <label className="field">
              اسم المقاول
              <input value={contractorName} onChange={(e) => setContractorName(e.target.value)} list="contractor-names" placeholder="اكتب اسم المقاول (اختياري)" />
              <datalist id="contractor-names">
                {contractors.data?.map((c) => <option key={c.id} value={c.name} />)}
              </datalist>
            </label>
          </>
        ) : (
          <label className="field span-2">
            بيان الوارد
            <input value={incomeLabel} onChange={(e) => setIncomeLabel(e.target.value)} placeholder="مثلاً: دفعة عميل" required />
          </label>
        )}

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
        {error && <p className="msg msg-error span-2">{error}</p>}
        <div className="dialog-actions span-2">
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
