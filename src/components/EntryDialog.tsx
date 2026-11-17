import { useCallback, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { todayISO } from '../lib/format'
import Dialog from './Dialog'
import Segmented from './Segmented'
import EntryExpenseFields from './EntryExpenseFields'
import EntryHistory from './EntryHistory'
import { createCategory as saveCategory, fetchCategories, type Category } from '../lib/catalog'
import { deleteEntry } from '../lib/entries'
import InvoiceField from './InvoiceField'
import BankPicker from './BankPicker'
import { saveEntry } from '../lib/entrySave'
import { CHANGED, KINDS, SAVE_ERRORS } from './entryDialogText'
import { useAsync } from '../lib/useAsync'
import { useSubmitGuard } from '../lib/useSubmitGuard'
import { fetchBankNames, fetchContractorNames, fetchMyBankIds, type BankChoice, type Named } from '../lib/lookups'
import { isRefund } from '../lib/entryKind'
import type { Entry, ProjectSummary } from '../lib/projects'
import { STATUS } from '../lib/status'

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
  const mayDelete = Boolean(entry) && (isStaff || (canDeleteOwn && entry?.status !== STATUS.approved))
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
  const [kind, setKind] = useState<'income' | 'expense' | 'refund'>(
    entry ? (isRefund(entry) ? 'refund' : entry.kind) : 'expense',
  )
  const [categoryName, setCategoryName] = useState(entry && entry.kind === 'expense' ? entry.category : '')
  const [itemName, setItemName] = useState(entry?.item ?? '')
  const [contractorName, setContractorName] = useState(entry?.contractor?.name ?? '')
  const [noContractor, setNoContractor] = useState(false)
  const [noInvoice, setNoInvoice] = useState(false)
  const [bankName, setBankName] = useState(entry?.bank?.name ?? '')
  const [incomeLabel, setIncomeLabel] = useState(entry?.kind === 'income' ? entry.category : '')
  const [amount, setAmount] = useState(entry ? String(Math.abs(entry.amount)) : '')
  const [date, setDate] = useState(() => entry?.entry_date ?? todayISO())
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const guard = useSubmitGuard()
  // one id per try: sending the same try again (a lost answer, a second tap) can never make a second entry
  const attemptId = useRef<string | null>(null)
  const [targetProject, setTargetProject] = useState(projectId)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<string | null>(null)
  const fromAdvance = Boolean(advanceId ?? entry?.advance_id)
  // a new entry from a custody or an owner needs its photo, and a contractor (or «بدون مقاول»)
  const strict = !entry && (fromAdvance || isOwner)

  const category = categories.data?.find((c) => c.name === categoryName)
  const categoryOptions = useMemo(() => {
    const names = (categories.data ?? []).map((c) => c.name)
    if (categoryName && !names.includes(categoryName)) names.push(categoryName)
    return names
  }, [categories.data, categoryName])

  const contractorOptions = useMemo(() => (contractors.data ?? []).map((c) => c.name), [contractors.data])

  async function createCategory(name: string) {
    if (!(await saveCategory(name))) return null
    categories.reload()
    return name
  }

  function remove() {
    void guard(removeNow)
  }

  async function removeNow() {
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
    setNoInvoice(false)
    setDone(message)
    setCategoryName('')
    setItemName('')
    setContractorName('')
    setNoContractor(false)
    setBankName('')
    setIncomeLabel('')
    setAmount('')
    setNotes('')
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    void guard(send)
  }

  async function send() {
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
      noContractor,
      requirePhoto: strict,
      requireContractorChoice: strict,
      bankName,
      amount,
      date,
      notes,
      targetProject,
      editReason,
      files,
      noInvoice,
      contractors: contractors.data ?? undefined,
      banks: (isOwner ? ownerBanks : banks.data) ?? undefined,
      banksOnly: isOwner,
      newId: (attemptId.current ??= crypto.randomUUID()),
    })
    setSaving(false)
    if (r.status === 'error') return setError(r.error === 'changed' ? CHANGED : SAVE_ERRORS[r.error])
    attemptId.current = null // saved or kept on the device: the next entry is a new try
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
          <div className="field span-2 kind-field">
            النوع
            <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
          </div>
        )}

        {kind !== 'income' ? (
          <EntryExpenseFields
            category={category}
            categoryName={categoryName}
            categoryOptions={categoryOptions}
            onCategory={(v) => {
              setCategoryName(v)
              setItemName('')
            }}
            onCreateCategory={createCategory}
            contractorName={contractorName}
            contractorOptions={contractorOptions}
            noContractor={noContractor}
            onContractor={setContractorName}
            onNoContractor={setNoContractor}
            itemName={itemName}
            onItem={setItemName}
            strict={strict}
          />
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
                isOwner
                  ? 'اختار البنك'
                  : kind === 'income' || kind === 'refund'
                    ? 'اتودّع في أنهي بنك'
                    : 'مدفوع من أنهي بنك'
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
          <label className="field span-2 reason">
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
          canRemove={isStaff || entry?.status !== STATUS.approved}
          readOnly={locked}
          required={strict && !noInvoice}
          noInvoice={strict ? noInvoice : undefined}
          onNoInvoice={
            strict
              ? (v) => {
                  setNoInvoice(v)
                  if (v) setFiles([])
                }
              : undefined
          }
        />
      </fieldset>
      {locked && <p className="msg span-2 muted">مفيش عندك صلاحية تعدّل القيود.</p>}
      {entry?.status === STATUS.rejected && entry.reject_reason && (
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
                ? isAdmin || entry.status === STATUS.approved
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
