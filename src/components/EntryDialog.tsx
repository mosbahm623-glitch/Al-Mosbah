import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { todayISO } from '../lib/format'
import Dialog from './Dialog'
import Segmented from './Segmented'
import CreatableSelect from './CreatableSelect'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'
import type { Entry, ProjectSummary } from '../lib/projects'

const KINDS = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'وارد' },
] as const

type Category = { id: string; name: string; expense_items: { id: string; name: string }[] }
type Contractor = { id: string; name: string }
type Bank = { id: string; name: string }

type Props = {
  projectId: string
  projectName: string
  projects?: ProjectSummary[]
  /** new entries are paid from this custody (counted through the custody, not as project expense) */
  advanceId?: string
  entry?: Entry; onClose: () => void; onSaved: () => void }

const CHANGED = 'القيد ده اتغيّر (أو اتمسح) من حد تاني من وقت ما فتحته. اقفل النافذة وافتحه تاني عشان تشوف آخر نسخة وبعدين عدّل.'

export default function EntryDialog({ projectId, projectName, projects, advanceId, entry, onClose, onSaved }: Props) {
  const isAdmin = useAuth().profile?.role === 'admin'
  const fetchCategories = useCallback(
    () => supabase.from('expense_categories').select('id,name,expense_items(id,name)').order('name'),
    [],
  )
  const fetchContractors = useCallback(() => supabase.from('contractors').select('id,name').order('name'), [])
  const categories = useAsync<Category[]>(fetchCategories)
  const contractors = useAsync<Contractor[]>(fetchContractors)
  const fetchBanks = useCallback(() => supabase.from('bank_accounts').select('id,name').order('name'), [])
  const banks = useAsync<Bank[]>(fetchBanks)

  const [kind, setKind] = useState<'income' | 'expense'>(entry?.kind ?? 'expense')
  const [categoryName, setCategoryName] = useState(entry?.kind === 'expense' ? entry.category : '')
  const [itemName, setItemName] = useState(entry?.item ?? '')
  const [contractorName, setContractorName] = useState(entry?.contractor?.name ?? '')
  const [bankName, setBankName] = useState(entry?.bank?.name ?? '')
  const [incomeLabel, setIncomeLabel] = useState(entry?.kind === 'income' ? entry.category : '')
  const [amount, setAmount] = useState(entry ? String(entry.amount) : '')
  const [date, setDate] = useState(() => entry?.entry_date ?? todayISO())
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [targetProject, setTargetProject] = useState(projectId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fromAdvance = Boolean(advanceId ?? entry?.advance_id)

  const category = categories.data?.find((c) => c.name === categoryName)
  const categoryOptions = useMemo(() => {
    const names = (categories.data ?? []).map((c) => c.name)
    if (categoryName && !names.includes(categoryName)) names.push(categoryName)
    return names.map((n) => ({ value: n, label: n }))
  }, [categories.data, categoryName])

  async function createCategory(name: string) {
    const { data, error: err } = await supabase.from('expense_categories').insert({ name }).select('id').single()
    if (err || !data) return null
    categories.reload()
    return name
  }

  async function findOrCreateContractor(name: string) {
    const existing = contractors.data?.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const { data, error: err } = await supabase.from('contractors').insert({ name }).select('id').single()
    return err || !data ? null : (data.id as string)
  }

  async function findOrCreateBank(name: string) {
    const existing = banks.data?.find((b) => b.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    const { data, error: err } = await supabase.from('bank_accounts').insert({ name }).select('id').single()
    return err || !data ? null : (data.id as string)
  }

  async function remove() {
    if (!entry) return
    if (!confirmDelete) return setConfirmDelete(true)
    setSaving(true)
    const { data, error: err } = await supabase.from('entries').delete().eq('id', entry.id).eq('rev', entry.rev).select('id')
    setSaving(false)
    if (err) return setError('القيد ما اتحذفش، جرّب تاني')
    if (!data?.length) return setError(CHANGED)
    onSaved()
    onClose()
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = Number(amount)
    const isExpense = kind === 'expense'
    if (isExpense && !category) return setError('اختار البند')
    if (isExpense && !itemName.trim()) return setError('اكتب البيان')
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
    let bankId: string | null = null
    if (!fromAdvance && bankName.trim()) {
      bankId = await findOrCreateBank(bankName.trim())
      if (!bankId) {
        setSaving(false)
        return setError('ما قدرناش نحفظ اسم البنك، جرّب تاني')
      }
    }
    if (isExpense && category && !category.expense_items.some((i) => i.name === itemName.trim())) {
      // remember the name so it shows up as a suggestion next time; the entry does not depend on it
      await supabase.from('expense_items').insert({ name: itemName.trim(), category_id: category.id })
    }
    const row = {
      project_id: targetProject,
      kind,
      category: isExpense ? category!.name : incomeLabel.trim(),
      item: isExpense ? itemName.trim() : null,
      contractor_id: contractorId,
      bank_id: bankId,
      amount: value,
      entry_date: date,
      notes: notes.trim() || null,
    }
    const res = entry
      ? await supabase.from('entries').update(row).eq('id', entry.id).eq('rev', entry.rev).select('id')
      : await supabase.from('entries').insert({ ...row, advance_id: advanceId ?? null })
    setSaving(false)
    if (res.error) return setError('القيد ما اتحفظش، جرّب تاني')
    if (entry && !res.data?.length) return setError(CHANGED)
    onSaved()
    onClose()
  }

  return (
    <Dialog title={entry ? `تعديل القيد #${entry.seq}` : fromAdvance ? 'مصروف من العهدة' : 'قيد جديد'} subtitle={projectName} wide onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="dialog-form">
        {projects && (fromAdvance ? projects.length > 0 : entry && projects.length > 1) && (
          <label className="field span-2">
            المشروع
            <select value={targetProject} onChange={(e) => setTargetProject(e.target.value)} required={fromAdvance}>
              {fromAdvance && <option value="">اختار المشروع</option>}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!fromAdvance && (
          <div className="field span-2">
            النوع
            <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
          </div>
        )}

        {kind === 'expense' ? (
          <>
            <CreatableSelect
              label="البند"
              value={categoryName}
              options={categoryOptions}
              placeholder="اختار البند"
              required
              onChange={(v) => {
                setCategoryName(v)
                setItemName('')
              }}
              onCreate={createCategory}
            />
            <label className="field">
              البيان
              <input
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                list="item-names"
                placeholder={categoryName ? 'اكتب البيان' : 'اختار البند الأول'}
                disabled={!categoryName}
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
        {!fromAdvance && (
          <label className="field">
            البنك / الحساب
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              list="bank-names"
              placeholder={kind === 'income' ? 'اتودّع في أنهي بنك (اختياري)' : 'مدفوع من أنهي بنك (اختياري)'}
            />
            <datalist id="bank-names">
              {banks.data?.map((b) => <option key={b.id} value={b.name} />)}
            </datalist>
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
        {!isAdmin && <p className="msg span-2 muted">القيد هيروح للأدمن للموافقة، وبعدها بس هيتحسب في الأرقام.</p>}
        {error && <p className="msg msg-error span-2">{error}</p>}
        <div className="dialog-actions span-2">
          <button className="btn" disabled={saving}>
            {saving ? 'جارٍ الحفظ...' : entry ? 'حفظ التعديل' : 'حفظ القيد'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            إلغاء
          </button>
          {entry && (
            <button type="button" className="btn btn-danger" onClick={() => void remove()} disabled={saving}>
              {confirmDelete ? 'تأكيد الحذف نهائياً' : 'حذف القيد'}
            </button>
          )}
        </div>
      </form>
    </Dialog>
  )
}
