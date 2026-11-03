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

vi.mock('../entries', () => ({ insertEntry: m.insertEntry, updateEntry: m.updateEntry }))
vi.mock('../catalog', () => ({
  addExpenseItem: m.addExpenseItem,
  createBank: m.createBank,
  createContractor: m.createContractor,
}))
vi.mock('../offline/queue', () => ({ queueEntry: m.queueEntry }))
vi.mock('../attachments', () => ({ uploadInvoices: m.uploadInvoices }))
vi.mock('../offline/connection', async (original) => ({
  ...(await original<typeof import('../offline/connection')>()),
  isOnline: () => m.online,
}))

import { saveEntry, type SaveInput } from '../entrySave'
import type { Entry } from '../projects'

const category = { id: 'c1', name: 'كهرباء', expense_items: [{ id: 'i1', name: 'أسلاك' }] }
const base = (over: Partial<SaveInput> = {}): SaveInput =>
  ({
    fromAdvance: false,
    kind: 'expense',
    category,
    itemName: 'أسلاك',
    incomeLabel: '',
    contractorName: '',
    bankName: '',
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
    expect(await saveEntry(base({ banks, banksOnly: true }))).toEqual({ status: 'error', error: 'bank-required' })
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

  it('creates the typed bank when it is new, but never for a payment from a custody', async () => {
    m.createBank.mockResolvedValue('b9')
    await saveEntry(base({ bankName: 'بنك جديد' }))
    expect(m.insertEntry.mock.calls[0][0]).toMatchObject({ bank_id: 'b9' })
    m.createBank.mockClear()
    await saveEntry(base({ bankName: 'بنك جديد', fromAdvance: true }))
    expect(m.createBank).not.toHaveBeenCalled()
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
