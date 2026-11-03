import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { todayISO } from '../lib/format'
import Dialog from './Dialog'
import Segmented from './Segmented'
import CreatableSelect from './CreatableSelect'
import EntryHistory from './EntryHistory'
import {
  addExpenseItem,
  createBank,
  createCategory as saveCategory,
  createContractor,
  fetchCategories,
  type Category,
} from '../lib/catalog'
import { deleteEntry, insertEntry, updateEntry, type EntryInput } from '../lib/entries'
import { isNetworkError, isOnline } from '../lib/connection'
import { queueEntry } from '../lib/offlineQueue'
import { uploadInvoices } from '../lib/attachments'
import InvoiceField from './InvoiceField'
import { useAsync } from '../lib/useAsync'
import { fetchBankNames, fetchContractorNames, type Named } from '../lib/lookups'
import type { Entry, ProjectSummary } from '../lib/projects'

const KINDS = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'وارد' },
] as const

type Props = {
  projectId: string
  projectName: string
  projects?: ProjectSummary[]
  /** new entries are paid from this custody (counted through the custody, not as project expense) */
  advanceId?: string
  entry?: Entry
  /** quick entry page: shown on the page itself, with a project picker; the form clears after a save instead of closing */
  inline?: boolean
  onClose: () => void
  onSaved: () => void
}

const CHANGED =
  'القيد ده اتغيّر (أو اتمسح) من حد تاني من وقت ما فتحته. اقفل النافذة وافتحه تاني عشان تشوف آخر نسخة وبعدين عدّل.'

export default function EntryDialog({
  projectId,
  projectName,
  projects,
  advanceId,
  entry,
  inline,
  onClose,
  onSaved,
}: Props) {
  const { isAdmin, isStaff, canEditOwn, canDeleteOwn } = useAuth()
  // an existing entry: the admin may have switched editing and/or deleting off for this user
  const locked = Boolean(entry) && !canEditOwn
  const mayDelete = Boolean(entry) && (isStaff || (canDeleteOwn && entry?.status !== 'approved'))
  const categories = useAsync<Category[]>(fetchCategories)
  const contractors = useAsync<Named[]>(fetchContractorNames)
  const banks = useAsync<Named[]>(fetchBankNames)

  // invoice photos picked for a new entry (stored once the entry exists); savedId: the new entry when its photos failed
  const [editReason, setEditReason] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [savedId, setSavedId] = useState<string | null>(null)
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
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const fromAdvance = Boolean(advanceId ?? entry?.advance_id)

  const category = categories.data?.find((c) => c.name === categoryName)
  const categoryOptions = useMemo(() => {
    const names = (categories.data ?? []).map((c) => c.name)
    if (categoryName && !names.includes(categoryName)) names.push(categoryName)
    return names.map((n) => ({ value: n, label: n }))
  }, [categories.data, categoryName])

  async function createCategory(name: string) {
    if (!(await saveCategory(name))) return null
    categories.reload()
    return name
  }

  async function findOrCreateContractor(name: string) {
    const existing = contractors.data?.find((c) => c.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    return createContractor(name)
  }

  async function findOrCreateBank(name: string) {
    const existing = banks.data?.find((b) => b.name.trim().toLowerCase() === name.toLowerCase())
    if (existing) return existing.id
    return createBank(name)
  }

  async function remove() {
    if (!entry) return
    if (!confirmDelete) return setConfirmDelete(true)
    if (reason.trim().length < 2) return setError('اكتب سبب الحذف')
    setSaving(true)
    setError(null)
    const { data, error: err } = await deleteEntry(entry.id, entry.rev, reason.trim())
    setSaving(false)
    if (err) return setError('القيد ما اتحذفش، جرّب تاني')
    if (!data) return setError(CHANGED)
    onSaved()
    onClose()
  }

  /** quick entry: keep the project, kind and date for the next one */
  function resetForNext(message: string) {
    setFiles([])
    setDone(message)
    setCategoryName('')
    setItemName('')
    setContractorName('')
    setBankName('')
    setIncomeLabel('')
    setAmount('')
    setNotes('')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    // chosen once per try, so a try whose answer got lost can never become a second entry
    const newId = crypto.randomUUID()

    async function keepOnDevice(row: EntryInput, names: { contractor: string; bank: string }) {
      const kept = await queueEntry({
        id: newId,
        row,
        advanceId: advanceId ?? null,
        contractorName: names.contractor,
        bankName: names.bank,
        files,
        label: `${row.item ?? row.category} · ${row.amount}`,
      })
      setSaving(false)
      if (!kept) return setError('ما قدرناش نحفظ القيد على الجهاز')
      onSaved()
      if (!inline) return onClose()
      resetForNext('مفيش نت: القيد اتحفظ على جهازك وهيتبعت لوحده لما النت يرجع')
    }

    const value = Number(amount)
    const isExpense = kind === 'expense'
    if (isExpense && !category) return setError('اختار البند')
    if (isExpense && !itemName.trim()) return setError('اكتب البيان')
    if (!isExpense && !incomeLabel.trim()) return setError('اكتب بيان الوارد')
    if (!Number.isFinite(value) || value <= 0) return setError('المبلغ لازم يكون أكبر من صفر')
    if (!targetProject) return setError('اختار المشروع')
    setSaving(true)
    setError(null)
    setDone(null)
    const typedContractor = isExpense ? contractorName.trim() : ''
    const typedBank = fromAdvance ? '' : bankName.trim()
    const baseRow = {
      project_id: targetProject,
      kind,
      category: isExpense ? category!.name : incomeLabel.trim(),
      item: isExpense ? itemName.trim() : null,
      contractor_id: null as string | null,
      bank_id: null as string | null,
      amount: value,
      entry_date: date,
      notes: notes.trim() || null,
    }
    // a new entry recorded without a network waits on this device and is sent by itself when the network is back
    const offlineNew = !entry && !isOnline()
    if (offlineNew) return keepOnDevice(baseRow, { contractor: typedContractor, bank: typedBank })
    let contractorId: string | null = null
    if (typedContractor) {
      contractorId = await findOrCreateContractor(typedContractor)
      if (!contractorId) {
        if (!entry && !isOnline()) return keepOnDevice(baseRow, { contractor: typedContractor, bank: typedBank })
        setSaving(false)
        return setError('ما قدرناش نحفظ اسم المقاول، جرّب تاني')
      }
    }
    let bankId: string | null = null
    if (typedBank) {
      bankId = await findOrCreateBank(typedBank)
      if (!bankId) {
        if (!entry && !isOnline()) return keepOnDevice(baseRow, { contractor: typedContractor, bank: typedBank })
        setSaving(false)
        return setError('ما قدرناش نحفظ اسم البنك، جرّب تاني')
      }
    }
    if (isExpense && category && !category.expense_items.some((i) => i.name === itemName.trim())) {
      // remember the name so it shows up as a suggestion next time; the entry does not depend on it
      await addExpenseItem(itemName.trim(), category.id)
    }
    const row = { ...baseRow, contractor_id: contractorId, bank_id: bankId }
    if (entry && editReason.trim().length < 2) {
      setSaving(false)
      return setError('اكتب سبب التعديل')
    }
    const res = entry
      ? await updateEntry(entry.id, entry.rev, row, editReason)
      : await insertEntry(row, advanceId ?? null, newId)
    if (res.error) {
      // the network dropped while saving: keep the new entry on the device (same id, so it can never be doubled)
      if (!entry && isNetworkError(res.error)) return keepOnDevice(row, { contractor: '', bank: '' })
      setSaving(false)
      return setError(
        isNetworkError(res.error)
          ? 'مفيش نت دلوقتي. التعديل محتاج اتصال، جرّب لما النت يرجع'
          : 'القيد ما اتحفظش، جرّب تاني',
      )
    }
    if (entry && res.data !== true) {
      setSaving(false)
      return setError(CHANGED)
    }
    const created = entry ? undefined : (res.data as { id?: string; seq?: number }[] | null)?.[0]
    const failed = !entry && created?.id && files.length ? await uploadInvoices(created.id, files) : 0
    setSaving(false)
    onSaved()
    if (failed) setError(`القيد اتسجّل لكن ${failed} صورة ما اترفعتش. ضيفها من تعديل القيد`)
    if (!inline) {
      if (!failed) return onClose()
      setSavedId(created?.id ?? null) // stay open so the photos can be added again
      return setFiles([])
    }
    resetForNext(`اتسجّل القيد رقم ${created?.seq ?? ''} ومستنّي موافقتك`)
  }

  const form = (
    <form onSubmit={(e) => void submit(e)} className="dialog-form">
      <fieldset disabled={locked} style={{ display: 'contents', border: 0, margin: 0, padding: 0 }}>
        {projects && (fromAdvance || inline ? projects.length > 0 : entry && projects.length > 1) && (
          <label className="field span-2">
            المشروع
            <select
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value)}
              required={fromAdvance || inline}
            >
              {(fromAdvance || inline) && <option value="">اختار المشروع</option>}
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
                {category?.expense_items.map((i) => (
                  <option key={i.id} value={i.name} />
                ))}
              </datalist>
            </label>
            <label className="field">
              اسم المقاول
              <input
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                list="contractor-names"
                placeholder="اكتب اسم المقاول (اختياري)"
              />
              <datalist id="contractor-names">
                {contractors.data?.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </label>
          </>
        ) : (
          <label className="field span-2">
            بيان الوارد
            <input
              value={incomeLabel}
              onChange={(e) => setIncomeLabel(e.target.value)}
              placeholder="مثلاً: دفعة عميل"
              required
            />
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
              {banks.data?.map((b) => (
                <option key={b.id} value={b.name} />
              ))}
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
        {entry && !locked && (
          <label className="field span-2">
            سبب التعديل
            <input
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="مثلًا: المبلغ كان مكتوب غلط"
              required
            />
          </label>
        )}
        <InvoiceField
          entryId={entry?.id ?? savedId ?? undefined}
          files={files}
          onFiles={setFiles}
          canRemove={isStaff || entry?.status !== 'approved'}
          readOnly={locked}
        />
      </fieldset>
      {locked && <p className="msg span-2 muted">مفيش عندك صلاحية تعدّل القيود.</p>}
      {entry?.status === 'rejected' && entry.reject_reason && (
        <p className="msg msg-error span-2">اترفض القيد ده. السبب: {entry.reject_reason}</p>
      )}
      {isStaff && entry && <EntryHistory entryId={entry.id} />}
      {!isAdmin && <p className="msg span-2 muted">القيد هيروح للأدمن للموافقة، وبعدها بس هيتحسب في الأرقام.</p>}
      {confirmDelete && (
        <label className="field span-2">
          سبب الحذف
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثلًا: القيد اتسجل بالغلط"
            autoFocus
            required
          />
        </label>
      )}
      {error && <p className="msg msg-error span-2">{error}</p>}
      {done && (
        <p className="msg msg-ok span-2" role="status">
          {done}
        </p>
      )}
      <div className="dialog-actions span-2">
        {!locked && !savedId && (
          <button className="btn" disabled={saving}>
            {saving
              ? 'جارٍ الحفظ...'
              : entry
                ? isAdmin || entry.status === 'approved'
                  ? 'حفظ التعديل'
                  : 'حفظ وإعادة إرسال'
                : 'حفظ القيد'}
          </button>
        )}
        {!inline && (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {savedId ? 'إغلاق' : 'إلغاء'}
          </button>
        )}
        {mayDelete && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void remove()}
            disabled={saving || (confirmDelete && reason.trim().length < 2)}
          >
            {confirmDelete ? 'تأكيد حذف القيد' : 'حذف القيد'}
          </button>
        )}
      </div>
    </form>
  )
  if (inline) return <section className="panel quick-form">{form}</section>
  return (
    <Dialog
      title={entry ? `تعديل القيد #${entry.seq}` : fromAdvance ? 'مصروف من العهدة' : 'قيد جديد'}
      subtitle={projectName}
      wide
      onClose={onClose}
    >
      {form}
    </Dialog>
  )
}
