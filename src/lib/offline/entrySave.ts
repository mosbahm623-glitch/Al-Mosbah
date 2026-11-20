import { uploadInvoices } from '../entries/attachments'
import { addExpenseItem, type Category } from '../entries/catalog'
import { isNetworkError, isOnline } from '../net/connection'
import { insertEntry, updateEntry, type EntryInput } from '../entries/entries'
import type { Named } from '../core/lookups'
import { queueEntry } from './queue'
import type { Entry } from '../entries/entryTypes'

/** What the person filled in, plus the lists the names are matched against. */
export type SaveInput = {
  /** the entry being edited; none for a new one */
  entry?: Entry
  advanceId?: string
  fromAdvance: boolean
  /** «refund» is saved as an expense with a negative amount */
  kind: 'income' | 'expense' | 'refund'
  category?: Category
  itemName: string
  incomeLabel: string
  contractorName: string
  bankName: string
  amount: string
  date: string
  notes: string
  targetProject: string
  editReason: string
  files: File[]
  contractors?: Named[]
  banks?: Named[]
  /** the bank is picked from `banks` only: a name that is not in it is refused, never created */
  banksOnly?: boolean
  /** a new entry from a custody or an owner: at least one invoice photo is a must */
  requirePhoto?: boolean
  /** the person says outright that there is no invoice (only counts when a photo would be required) */
  noInvoice?: boolean
  /** same people: an expense names its contractor, or says outright that it has none */
  requireContractorChoice?: boolean
  noContractor?: boolean
  /** chosen once per try, so a try whose answer got lost can never become a second entry */
  newId: string
}

export type SaveError =
  | 'category'
  | 'item'
  | 'income'
  | 'amount'
  | 'project'
  | 'contractor'
  | 'contractor-choice'
  | 'photo'
  | 'bank'
  | 'bank-denied'
  | 'bank-required'
  | 'reason'
  | 'offline-edit'
  | 'failed'
  | 'changed'
  | 'device'

export type SaveOutcome =
  | { status: 'error'; error: SaveError }
  /** no network: the new entry waits on the device and is sent by itself later */
  | { status: 'queued' }
  | { status: 'saved'; id?: string; seq?: number; failedPhotos: number }

const fail = (error: SaveError): SaveOutcome => ({ status: 'error', error })

/**
 * Checks the form, resolves the typed contractor / bank names, and saves (or edits) the entry. A new entry made
 * without a network is kept on the device with its own id instead of failing.
 */
export async function saveEntry(input: SaveInput): Promise<SaveOutcome> {
  const { entry, advanceId, kind, category, newId } = input
  const isExpense = kind !== 'income'
  const value = Number(input.amount)
  if (isExpense && !category) return fail('category')
  if (isExpense && !input.itemName.trim()) return fail('item')
  if (!isExpense && !input.incomeLabel.trim()) return fail('income')
  if (!Number.isFinite(value) || value <= 0) return fail('amount')
  if (!input.targetProject) return fail('project')

  const typedContractor = isExpense && !input.noContractor ? input.contractorName.trim() : ''
  if (input.requireContractorChoice && isExpense && !typedContractor && !input.noContractor) {
    return fail('contractor-choice')
  }
  if (input.requirePhoto && !input.noInvoice && input.files.length === 0) return fail('photo')
  const typedBank = input.fromAdvance ? '' : input.bankName.trim()
  // every entry carries a bank (a payment from a custody has none)
  if (!input.fromAdvance && !typedBank) return fail('bank-required')
  // an income that already has a statement (البيان) under its own category keeps both: the text is the statement
  const incomeHasItem = !isExpense && entry?.kind === 'income' && Boolean(entry.item)
  const baseRow: EntryInput = {
    project_id: input.targetProject,
    kind: isExpense ? 'expense' : 'income',
    category: isExpense ? category!.name : incomeHasItem ? entry!.category : input.incomeLabel.trim(),
    item: isExpense ? input.itemName.trim() : incomeHasItem ? input.incomeLabel.trim() : null,
    contractor_id: null,
    bank_id: null,
    amount: kind === 'refund' ? -value : value,
    entry_date: input.date,
    notes: input.notes.trim() || null,
  }

  async function keepOnDevice(row: EntryInput, names: { contractor: string; bank: string }): Promise<SaveOutcome> {
    const kept = await queueEntry({
      id: newId,
      row,
      advanceId: advanceId ?? null,
      contractorName: names.contractor,
      bankName: names.bank,
      files: input.files,
      label: `${row.item ?? row.category} · ${row.amount}`,
    })
    return kept ? { status: 'queued' } : fail('device')
  }
  const typed = { contractor: typedContractor, bank: typedBank }
  let ownerBankId: string | null = null
  if (input.banksOnly && typedBank) {
    ownerBankId = input.banks?.find((x) => x.name.trim().toLowerCase() === typedBank.toLowerCase())?.id ?? null
    if (!ownerBankId) return fail('bank-denied')
  }

  // a new entry recorded without a network waits on this device and is sent by itself when the network is back
  if (!entry && !isOnline()) {
    // an owner's bank is already an id from his list: nothing is looked up or created when it is sent
    return ownerBankId
      ? keepOnDevice({ ...baseRow, bank_id: ownerBankId }, { contractor: typedContractor, bank: '' })
      : keepOnDevice(baseRow, typed)
  }

  // a contractor and a bank can only be picked from the existing ones: nothing is created here
  const contractorId = typedContractor
    ? (input.contractors?.find((x) => x.name.trim().toLowerCase() === typedContractor.toLowerCase())?.id ?? null)
    : null
  if (typedContractor && !contractorId) return fail('contractor')
  const bankId = typedBank ? ownerBankId : null
  if (typedBank && !bankId) return fail('bank-denied')
  if (isExpense && category && !category.expense_items.some((i) => i.name === input.itemName.trim())) {
    // remember the name so it shows up as a suggestion next time; the entry does not depend on it, so nothing waits for it
    void Promise.resolve(addExpenseItem(input.itemName.trim(), category.id)).catch(() => undefined)
  }

  const row: EntryInput = { ...baseRow, contractor_id: contractorId, bank_id: bankId }
  if (entry && input.editReason.trim().length < 2) return fail('reason')
  const res = entry
    ? await updateEntry(entry.id, entry.rev, row, input.editReason)
    : await insertEntry(row, advanceId ?? null, newId)
  // the same try arriving twice (a lost answer, a second tap): the first one already saved it
  if (!entry && (res.error as { code?: string } | null)?.code === '23505') {
    return { status: 'saved', id: newId, failedPhotos: 0 }
  }
  if (res.error) {
    // the network dropped while saving: keep the new entry on the device (same id, so it can never be doubled)
    if (!entry && isNetworkError(res.error)) return keepOnDevice(row, { contractor: '', bank: '' })
    const message = (res.error as { message?: string }).message ?? ''
    if (message.includes('bank not allowed')) return fail('bank-denied')
    if (message.includes('bank required')) return fail('bank-required')
    return fail(isNetworkError(res.error) ? 'offline-edit' : 'failed')
  }
  if (entry && res.data !== true) return fail('changed')

  const created = entry ? undefined : (res.data as { id?: string; seq?: number }[] | null)?.[0]
  const failedPhotos = !entry && created?.id && input.files.length ? await uploadInvoices(created.id, input.files) : 0
  return { status: 'saved', id: created?.id, seq: created?.seq, failedPhotos }
}
