import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  insertEntry: vi.fn(),
  uploadInvoices: vi.fn(),
  createContractor: vi.fn(),
  createBank: vi.fn(),
  fetchContractorNames: vi.fn(),
  fetchBankNames: vi.fn(),
  currentUserId: vi.fn(),
  online: true,
}))

vi.mock('../entries', () => ({ insertEntry: m.insertEntry }))
vi.mock('../attachments', () => ({ uploadInvoices: m.uploadInvoices }))
vi.mock('../catalog', () => ({ createContractor: m.createContractor, createBank: m.createBank }))
vi.mock('../lookups', () => ({ fetchContractorNames: m.fetchContractorNames, fetchBankNames: m.fetchBankNames }))
vi.mock('../offline/auth', () => ({ currentUserId: m.currentUserId }))
vi.mock('../events', () => ({ notifyDataChanged: vi.fn() }))
vi.mock('../offline/connection', async (original) => ({
  ...(await original<typeof import('../offline/connection')>()),
  isOnline: () => m.online,
}))

import { discardQueued, queueEntry, queueSnapshot, retryQueued, syncQueue, type QueuedEntry } from '../offline/queue'

const row = {
  project_id: 'p1',
  kind: 'expense' as const,
  category: 'كهرباء',
  item: 'أسلاك',
  contractor_id: null,
  bank_id: null,
  amount: 500,
  entry_date: '2026-11-03',
  notes: null,
}
const input = (over: Partial<Parameters<typeof queueEntry>[0]> = {}) => ({
  row,
  advanceId: null,
  contractorName: '',
  bankName: '',
  files: [],
  label: 'أسلاك · 500',
  ...over,
})
const ok = { data: [{ id: 'x', seq: 1 }], error: null }

beforeEach(async () => {
  for (const q of queueSnapshot()) await discardQueued(q.id)
  vi.clearAllMocks()
  m.online = true
  m.currentUserId.mockResolvedValue('u1')
  m.insertEntry.mockResolvedValue(ok)
  m.fetchContractorNames.mockResolvedValue({ data: [{ id: 'c1', name: 'أحمد' }] })
  m.fetchBankNames.mockResolvedValue({ data: [{ id: 'b1', name: 'CIB' }] })
})

describe('queueEntry', () => {
  it('keeps the entry on the device with its own id', async () => {
    expect(await queueEntry(input())).toBe(true)
    const [q] = queueSnapshot()
    expect(q).toMatchObject({ userId: 'u1', label: 'أسلاك · 500', row })
    expect(q.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('keeps the id it was given (a try that already reached the server cannot become a second entry)', async () => {
    await queueEntry(input({ id: 'fixed-id' }))
    expect(queueSnapshot()[0].id).toBe('fixed-id')
  })

  it('refuses when nobody is signed in', async () => {
    m.currentUserId.mockResolvedValue(null)
    expect(await queueEntry(input())).toBe(false)
    expect(queueSnapshot()).toHaveLength(0)
  })
})

describe('syncQueue', () => {
  it('sends the waiting entries oldest first, with their ids, and clears them', async () => {
    await queueEntry(input({ id: 'first' }))
    await new Promise((r) => setTimeout(r, 5))
    await queueEntry(input({ id: 'second', label: 'تاني' }))
    expect(await syncQueue()).toBe(2)
    expect(m.insertEntry.mock.calls.map((c) => c[2])).toEqual(['first', 'second'])
    expect(queueSnapshot()).toHaveLength(0)
  })

  it('sends nothing while offline', async () => {
    await queueEntry(input())
    m.online = false
    expect(await syncQueue()).toBe(0)
    expect(m.insertEntry).not.toHaveBeenCalled()
    expect(queueSnapshot()).toHaveLength(1)
  })

  it('keeps everything and stops at a network failure', async () => {
    await queueEntry(input({ id: 'a' }))
    await new Promise((r) => setTimeout(r, 5))
    await queueEntry(input({ id: 'b' }))
    m.insertEntry.mockResolvedValue({ data: null, error: { message: 'TypeError: Failed to fetch' } })
    expect(await syncQueue()).toBe(0)
    expect(m.insertEntry).toHaveBeenCalledTimes(1)
    expect(queueSnapshot().map((q) => q.error)).toEqual([undefined, undefined])
  })

  it('counts an already-arrived entry (same id) as sent', async () => {
    await queueEntry(input())
    m.insertEntry.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    expect(await syncQueue()).toBe(1)
    expect(queueSnapshot()).toHaveLength(0)
  })

  it('marks a refused entry instead of retrying it forever, and lets the person retry it', async () => {
    await queueEntry(input())
    m.insertEntry.mockResolvedValue({ data: null, error: { code: '42501', message: 'row violates policy' } })
    expect(await syncQueue()).toBe(0)
    const [q] = queueSnapshot()
    expect(q.error).toBeTruthy()

    expect(await syncQueue()).toBe(0)
    expect(m.insertEntry).toHaveBeenCalledTimes(1)

    m.insertEntry.mockResolvedValue(ok)
    await retryQueued(q.id)
    await vi.waitFor(() => expect(queueSnapshot()).toHaveLength(0))
  })

  it('treats an expired sign-in as "later", not as a refusal', async () => {
    await queueEntry(input())
    m.insertEntry.mockResolvedValue({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })
    await syncQueue()
    expect(queueSnapshot()[0].error).toBeUndefined()
  })

  it('only sends the entries of the signed-in person', async () => {
    await queueEntry(input({ id: 'mine' }))
    m.currentUserId.mockResolvedValue('u2')
    await queueEntry(input({ id: 'his' }))
    expect(await syncQueue()).toBe(1)
    expect(m.insertEntry.mock.calls.map((c) => c[2])).toEqual(['his'])
    expect(queueSnapshot().map((q: QueuedEntry) => q.id)).toEqual(['mine'])
  })

  it('matches typed names with existing ones and creates the new ones when sending', async () => {
    m.createBank.mockResolvedValue('b-new')
    await queueEntry(input({ contractorName: ' أحمد ', bankName: 'بنك جديد' }))
    await syncQueue()
    expect(m.createContractor).not.toHaveBeenCalled()
    expect(m.createBank).toHaveBeenCalledWith('بنك جديد')
    expect(m.insertEntry.mock.calls[0][0]).toMatchObject({ contractor_id: 'c1', bank_id: 'b-new' })
  })

  it('keeps the entry for later when a typed name cannot be saved yet', async () => {
    m.createBank.mockResolvedValue(null)
    await queueEntry(input({ bankName: 'بنك جديد' }))
    expect(await syncQueue()).toBe(0)
    expect(m.insertEntry).not.toHaveBeenCalled()
    expect(queueSnapshot()).toHaveLength(1)
  })

  it('uploads the invoice photos after the entry arrives', async () => {
    const photo = new File(['x'], 'a.jpg', { type: 'image/jpeg' })
    await queueEntry(input({ id: 'e1', files: [photo] }))
    await syncQueue()
    expect(m.uploadInvoices).toHaveBeenCalledWith('e1', [photo])
  })
})
