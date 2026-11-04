import { useCallback, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { todayISO } from '../lib/format'
import Dialog from './Dialog'
import Segmented from './Segmented'
import CreatableSelect from './CreatableSelect'
import EntryHistory from './EntryHistory'
import { createCategory as saveCategory, fetchCategories, type Category } from '../lib/catalog'
import { deleteEntry } from '../lib/entries'
import InvoiceField from './InvoiceField'
import BankPicker from './BankPicker'
import { saveEntry, type SaveError } from '../lib/entrySave'
import { useAsync } from '../lib/useAsync'
import { fetchBankNames, fetchContractorNames, fetchMyBankIds, type BankChoice, type Named } from '../lib/lookups'
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

const SAVE_ERRORS: Record<Exclude<SaveError, 'changed'>, string> = {
  category: 'اختار البند',
  item: 'اكتب البيان',
  income: 'اكتب بيان الوارد',
  amount: 'المبلغ لازم يكون أكبر من صفر',
  project: 'اختار المشروع',
  contractor: 'ما قدرناش نحفظ اسم المقاول، جرّب تاني',
  bank: 'ما قدرناش نحفظ اسم البنك، جرّب تاني',
  'bank-required': 'اختار البنك',
  'bank-denied': 'البنك ده مش من البنوك المسموحة ليك. اختار من القايمة أو كلّم الأدمن',
  reason: 'اكتب سبب التعديل',
  'offline-edit': 'مفيش نت دلوقتي. التعديل محتاج اتصال، جرّب لما النت يرجع',
  failed: 'القيد ما اتحفظش، جرّب تاني',
  device: 'ما قدرناش نحفظ القيد على الجهاز',
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
  const { isAdmin, isStaff, isOwner, profile, canEditOwn, canDeleteOwn } = useAuth()
  // an existing entry: the admin may have switched editing and/or deleting off for this user
  const locked = Boolean(entry) && !canEditOwn
  const mayDelete = Boolean(entry) && (isStaff || (canDeleteOwn && entry?.status !== 'approved'))
  const categories = useAsync<Category[]>(fetchCategories)
  const contractors = useAsync<Named[]>(fetchContractorNames)
  const banks = useAsync<BankChoice[]>(fetchBankNames)
  // an owner picks from the banks the admin gave him; everyone else may type any bank
  // (memoized: useAsync runs again whenever the function it gets changes)
  const ownerId = isOwner ? (profile?.id ?? null) : null
  const loadMyBankIds = useCallback(
    () => (ownerId ? fetchMyBankIds(ownerId) : Promise.resolve({ data: [] as string[], error: null })),
    [ownerId],
  )
  const myBankIds = useAsync<string[]>(loadMyBankIds)
  const ownerBanks = isOwner
    ? (banks.data ?? []).filter((b) => myBankIds.data?.includes(b.id) || b.name === entry?.bank?.name)
    : []

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
    setSaving(true)
    setError(null)
    setDone(null)
    const r = await saveEntry({
      entry,
      advanceId,
      fromAdvance,
      kind,
      category,
      itemName,
      incomeLabel,
      contractorName,
      bankName,
      amount,
      date,
      notes,
      targetProject,
      editReason,
      files,
      contractors: contractors.data ?? undefined,
      banks: (isOwner ? ownerBanks : banks.data) ?? undefined,
      banksOnly: isOwner,
      newId: crypto.randomUUID(),
    })
    setSaving(false)
    if (r.status === 'error') return setError(r.error === 'changed' ? CHANGED : SAVE_ERRORS[r.error])
    onSaved()
    if (r.status === 'queued') {
      if (!inline) return onClose()
      return resetForNext('مفيش نت: القيد اتحفظ على جهازك وهيتبعت لوحده لما النت يرجع')
    }
    if (r.failedPhotos) setError(`القيد اتسجّل لكن ${r.failedPhotos} صورة ما اترفعتش. ضيفها من تعديل القيد`)
    if (!inline) {
      if (!r.failedPhotos) return onClose()
      setSavedId(r.id ?? null) // stay open so the photos can be added again
      return setFiles([])
    }
    resetForNext(`اتسجّل القيد رقم ${r.seq ?? ''} ومستنّي موافقتك`)
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
          <div className="field">
            البنك / الحساب
            <BankPicker
              value={bankName}
              onChange={setBankName}
              banks={isOwner ? ownerBanks : (banks.data ?? [])}
              allowNew={!isOwner}
              placeholder={
                isOwner ? 'اختار البنك' : kind === 'income' ? 'اتودّع في أنهي بنك' : 'مدفوع من أنهي بنك (اختياري)'
              }
            />
          </div>
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
