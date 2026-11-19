import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  insertEntry: vi.fn(),
  updateEntry: vi.fn(),
  addExpenseItem: vi.fn(),
  createBank: vi.fn(),
  createContractor: vi.fn(),
  queueEntry: vi.fn(),
  uploadInvoices: vi.fn(),
  online: true,
}))

vi.mock('../entries/entries', () => ({ insertEntry: m.insertEntry, updateEntry: m.updateEntry }))
vi.mock('../entries/catalog', () => ({
  addExpenseItem: m.addExpenseItem,
  createBank: m.createBank,
  createContractor: m.createContractor,
}))
vi.mock('../offline/queue', () => ({ queueEntry: m.queueEntry }))
vi.mock('../entries/attachments', () => ({ uploadInvoices: m.uploadInvoices }))
vi.mock('../net/connection', async (original) => ({
  ...(await original<typeof import('../net/connection')>()),
  isOnline: () => m.online,
}))

import { saveEntry, type SaveInput } from '../offline/entrySave'
import type { Entry } from '../entries/entryTypes'

const category = { id: 'c1', name: 'كهرباء', expense_items: [{ id: 'i1', name: 'أسلاك' }] }
const base = (over: Partial<SaveInput> = {}): SaveInput =>
  ({
    fromAdvance: false,
    kind: 'expense',
    category,
    itemName: 'أسلاك',
    incomeLabel: '',
    contractorName: '',
    bankName: 'الأهلي',
    banks: [{ id: 'b1', name: 'الأهلي' }],
    banksOnly: true,
    amount: '500',
    date: '2026-11-03',
    notes: '',
    targetProject: 'p1',
    editReason: '',
    files: [],
    newId: 'new-id',
    ...over,
  }) as SaveInput

beforeEach(() => {
  vi.clearAllMocks()
  m.online = true
  m.insertEntry.mockResolvedValue({ data: [{ id: 'e1', seq: 20260001 }], error: null })
  m.updateEntry.mockResolvedValue({ data: true, error: null })
  m.queueEntry.mockResolvedValue(true)
  m.uploadInvoices.mockResolvedValue(0)
})

describe('saveEntry: checks', () => {
  it.each([
    ['category', { category: undefined }],
    ['item', { itemName: '  ' }],
    ['income', { kind: 'income' as const, incomeLabel: '' }],
    ['amount', { amount: '0' }],
    ['project', { targetProject: '' }],
  ])('refuses a form with a missing %s without touching the database', async (error, over) => {
    expect(await saveEntry(base(over))).toEqual({ status: 'error', error })
    expect(m.insertEntry).not.toHaveBeenCalled()
  })

  it('asks for a reason when editing', async () => {
    const entry = { id: 'e', rev: 2 } as Entry
    expect(await saveEntry(base({ entry, editReason: ' ' }))).toEqual({ status: 'error', error: 'reason' })
    expect(m.updateEntry).not.toHaveBeenCalled()
  })
})

describe('saveEntry: owner banks', () => {
  const banks = [{ id: 'b1', name: 'الأهلي' }]
  it('takes a bank from his list and never creates one', async () => {
    await saveEntry(base({ bankName: 'الأهلي', banks, banksOnly: true }))
    expect(m.insertEntry.mock.calls[0][0]).toMatchObject({ bank_id: 'b1' })
    expect(m.createBank).not.toHaveBeenCalled()
  })
  it('refuses an owner entry without a bank, but not a payment from a custody', async () => {
    expect(await saveEntry(base({ bankName: '', banks, banksOnly: true }))).toEqual({
      status: 'error',
      error: 'bank-required',
    })
    expect(m.insertEntry).not.toHaveBeenCalled()
    await saveEntry(base({ banks, banksOnly: true, fromAdvance: true, advanceId: 'a1' }))
    expect(m.insertEntry).toHaveBeenCalled()
  })
  it('refuses a bank that is not on his list, online or offline', async () => {
    expect(await saveEntry(base({ bankName: 'مصر', banks, banksOnly: true }))).toEqual({
      status: 'error',
      error: 'bank-denied',
    })
    m.online = false
    expect(await saveEntry(base({ bankName: 'مصر', banks, banksOnly: true }))).toEqual({
      status: 'error',
      error: 'bank-denied',
    })
    expect(m.createBank).not.toHaveBeenCalled()
    expect(m.insertEntry).not.toHaveBeenCalled()
  })
  it('keeps the chosen bank id on the device when offline', async () => {
    m.online = false
    await saveEntry(base({ bankName: 'الأهلي', banks, banksOnly: true }))
    expect(m.queueEntry.mock.calls[0][0]).toMatchObject({ row: { bank_id: 'b1' }, bankName: '' })
  })
  it('turns the server refusal into bank-denied', async () => {
    m.insertEntry.mockResolvedValue({ data: null, error: { message: 'bank not allowed', code: 'P0001' } })
    expect(await saveEntry(base({ bankName: 'الأهلي', banks, banksOnly: true }))).toEqual({
      status: 'error',
      error: 'bank-denied',
    })
  })
})

describe('saveEntry: every entry needs a bank', () => {
  const income = (over: Partial<SaveInput> = {}) =>
    base({ kind: 'income', category: undefined, itemName: '', incomeLabel: 'دفعة عميل', ...over })
  it('refuses an income without a bank', async () => {
    expect(await saveEntry(income({ bankName: '' }))).toEqual({ status: 'error', error: 'bank-required' })
    expect(m.insertEntry).not.toHaveBeenCalled()
  })
  it('saves an income that has a bank', async () => {
    await saveEntry(income({ bankName: 'الأهلي' }))
    expect(m.insertEntry.mock.calls[0][0]).toMatchObject({ kind: 'income', bank_id: 'b1' })
  })
  it('refuses an expense without a bank too, but not a payment from a custody', async () => {
    expect(await saveEntry(base({ bankName: '' }))).toEqual({ status: 'error', error: 'bank-required' })
    expect(m.insertEntry).not.toHaveBeenCalled()
    await saveEntry(base({ fromAdvance: true, advanceId: 'a1' }))
    expect(m.insertEntry).toHaveBeenCalled()
  })
})

describe('saveEntry: the same try sent twice', () => {
  it('counts a duplicate id as already saved, not as a failure and not as a second entry', async () => {
    m.insertEntry.mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "entries_pkey"', code: '23505' },
    })
    expect(await saveEntry(base({ newId: 'same-try' }))).toEqual({ status: 'saved', id: 'same-try', failedPhotos: 0 })
    expect(m.uploadInvoices).not.toHaveBeenCalled()
  })
})

describe('saveEntry: refund (مرتجع)', () => {
  it('is saved as an expense with a negative amount, with the same fields as an expense', async () => {
    m.insertEntry.mockResolvedValue({ data: [{ id: 'new-id', seq: 9 }], error: null })
    const r = await saveEntry(base({ kind: 'refund', amount: '500' }))
    expect(r.status).toBe('saved')
    const row = m.insertEntry.mock.calls.at(-1)?.[0]
    expect(row).toMatchObject({ kind: 'expense', amount: -500, category: 'كهرباء', item: 'أسلاك' })
  })

  it('still needs a category, an item and an amount above zero', async () => {
    expect(await saveEntry(base({ kind: 'refund', category: undefined }))).toEqual({
      status: 'error',
      error: 'category',
    })
    expect(await saveEntry(base({ kind: 'refund', itemName: ' ' }))).toEqual({ status: 'error', error: 'item' })
    expect(await saveEntry(base({ kind: 'refund', amount: '-5' }))).toEqual({ status: 'error', error: 'amount' })
  })
})

describe('saveEntry: saving', () => {
  it('inserts a new entry with its own id and reports the number it got', async () => {
    const r = await saveEntry(base({ advanceId: 'a1' }))
    expect(m.insertEntry).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'p1', amount: 500 }),
      'a1',
      'new-id',
    )
    expect(r).toEqual({ status: 'saved', id: 'e1', seq: 20260001, failedPhotos: 0 })
  })

  it('matches a typed contractor with an existing one instead of creating it again', async () => {
    await saveEntry(base({ contractorName: ' أحمد '.trim(), contractors: [{ id: 'k1', name: 'أحمد' }] }))
    expect(m.createContractor).not.toHaveBeenCalled()
    expect(m.insertEntry.mock.calls[0][0]).toMatchObject({ contractor_id: 'k1' })
  })

  it('never creates a bank or a contractor: a name that is not in the lists is refused', async () => {
    expect(await saveEntry(base({ bankName: 'بنك جديد' }))).toEqual({ status: 'error', error: 'bank-denied' })
    expect(await saveEntry(base({ contractorName: 'مقاول جديد', contractors: [] }))).toEqual({
      status: 'error',
      error: 'contractor',
    })
    expect(m.createBank).not.toHaveBeenCalled()
    expect(m.createContractor).not.toHaveBeenCalled()
    expect(m.insertEntry).not.toHaveBeenCalled()
  })

  it('remembers a new item name as a suggestion', async () => {
    await saveEntry(base({ itemName: 'بند جديد' }))
    expect(m.addExpenseItem).toHaveBeenCalledWith('بند جديد', 'c1')
  })

  it('reports photos that did not upload', async () => {
    m.uploadInvoices.mockResolvedValue(2)
    const r = await saveEntry(base({ files: [new File(['x'], 'a.jpg')] }))
    expect(r).toMatchObject({ status: 'saved', failedPhotos: 2 })
  })

  it('edits at the revision shown and reports a changed entry', async () => {
    const entry = { id: 'e', rev: 3 } as Entry
    await saveEntry(base({ entry, editReason: 'مبلغ غلط' }))
    expect(m.updateEntry).toHaveBeenCalledWith('e', 3, expect.any(Object), 'مبلغ غلط')
    m.updateEntry.mockResolvedValue({ data: false, error: null })
    expect(await saveEntry(base({ entry, editReason: 'مبلغ غلط' }))).toEqual({ status: 'error', error: 'changed' })
  })
})

describe('saveEntry: without a network', () => {
  it('keeps a new entry on the device and sends nothing', async () => {
    m.online = false
    expect(await saveEntry(base({ contractorName: 'أحمد' }))).toEqual({ status: 'queued' })
    expect(m.queueEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id', contractorName: 'أحمد' }))
    expect(m.insertEntry).not.toHaveBeenCalled()
  })

  it('keeps it when the connection drops during the save (same id, so it cannot be doubled)', async () => {
    m.insertEntry.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    expect(await saveEntry(base())).toEqual({ status: 'queued' })
    expect(m.queueEntry).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-id' }))
  })

  it('does not queue an edit: it needs a connection', async () => {
    m.updateEntry.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    const r = await saveEntry(base({ entry: { id: 'e', rev: 1 } as Entry, editReason: 'سبب' }))
    expect(r).toEqual({ status: 'error', error: 'offline-edit' })
    expect(m.queueEntry).not.toHaveBeenCalled()
  })

  it('says so when the device cannot keep it either', async () => {
    m.online = false
    m.queueEntry.mockResolvedValue(false)
    expect(await saveEntry(base())).toEqual({ status: 'error', error: 'device' })
  })
})

describe('saveEntry: custody and owner rules', () => {
  const photo = new File(['x'], 'inv.jpg', { type: 'image/jpeg' })
  const strict = (over: Partial<SaveInput> = {}) =>
    base({
      requirePhoto: true,
      requireContractorChoice: true,
      files: [photo],
      contractorName: 'رجب رخام',
      contractors: [{ id: 'k1', name: 'رجب رخام' }],
      ...over,
    })

  it('refuses a new entry with no invoice photo', async () => {
    expect(await saveEntry(strict({ files: [] }))).toEqual({ status: 'error', error: 'photo' })
    expect(m.insertEntry).not.toHaveBeenCalled()
  })
  it('accepts «بدون فاتورة» in place of a photo, and sends no photos', async () => {
    expect((await saveEntry(strict({ files: [], noInvoice: true }))).status).toBe('saved')
    expect(m.uploadInvoices).not.toHaveBeenCalled()
  })
  it('refuses an expense that names no contractor and does not say «بدون مقاول»', async () => {
    expect(await saveEntry(strict({ contractorName: '  ' }))).toEqual({ status: 'error', error: 'contractor-choice' })
    expect(m.insertEntry).not.toHaveBeenCalled()
  })
  it('accepts «بدون مقاول» and saves with no contractor, even if a name was typed before', async () => {
    const r = await saveEntry(strict({ noContractor: true, contractorName: 'رجب رخام' }))
    expect(r.status).toBe('saved')
    expect(m.insertEntry.mock.calls[0][0].contractor_id).toBeNull()
  })
  it('accepts a named contractor with a photo', async () => {
    expect((await saveEntry(strict())).status).toBe('saved')
    expect(m.insertEntry.mock.calls[0][0].contractor_id).toBe('k1')
  })
  it('does not ask an income entry for a contractor, but still wants its photo', async () => {
    const income = { kind: 'income' as const, incomeLabel: 'دفعة عميل', contractorName: '' }
    expect(await saveEntry(strict({ ...income, files: [] }))).toEqual({ status: 'error', error: 'photo' })
    expect((await saveEntry(strict(income))).status).toBe('saved')
  })
  it('leaves everyone else alone: no photo and no contractor is fine', async () => {
    expect((await saveEntry(base())).status).toBe('saved')
  })
})
