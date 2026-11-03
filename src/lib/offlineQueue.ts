import { isNetworkError, isOnline } from './connection'
import { createBank, createContractor } from './catalog'
import { insertEntry, type EntryInput } from './entries'
import { uploadInvoices } from './attachments'
import { notifyDataChanged } from './events'
import { fetchBankNames, fetchContractorNames, type Named } from './lookups'
import { currentUserId } from './offlineAuth'
import { kvDelete, kvSet, kvValues } from './offlineStore'

/**
 * New entries recorded without a network wait here, on the device, and go to the server by themselves when the network
 * is back. The entry gets its number (and its approval status) from the server at that moment, so nothing is faked
 * locally. Edits, deletes and approvals always need the network.
 */
export type QueuedEntry = {
  /** also the id the entry will have in the database: sending the same one twice can never make two entries */
  id: string
  userId: string
  row: EntryInput
  advanceId: string | null
  /** typed names are matched (or created) when the entry is sent, so a new contractor or bank can be typed offline */
  contractorName: string
  bankName: string
  files: File[]
  /** one line shown in the waiting list */
  label: string
  queuedAt: string
  /** set when the server refused the entry (not a network problem): the person decides what to do */
  error?: string
}

export type QueueInput = Pick<QueuedEntry, 'row' | 'advanceId' | 'contractorName' | 'bankName' | 'files' | 'label'> & {
  /** pass the id already tried online, so a try whose answer was lost cannot become a second entry */
  id?: string
}

let snapshot: QueuedEntry[] = []
const listeners = new Set<() => void>()

function publish(items: QueuedEntry[]) {
  snapshot = items.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
  for (const l of listeners) l()
}

async function reload() {
  publish(await kvValues<QueuedEntry>('queue'))
}

/** For the waiting list on screen (works with `useSyncExternalStore`). */
export const queueSnapshot = () => snapshot
export function subscribeQueue(onChange: () => void) {
  listeners.add(onChange)
  return () => void listeners.delete(onChange)
}

/** Keeps one entry on the device. Returns false when nobody is signed in. */
export async function queueEntry(input: QueueInput): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false
  const item: QueuedEntry = {
    ...input,
    id: input.id ?? crypto.randomUUID(),
    userId,
    queuedAt: new Date().toISOString(),
  }
  await kvSet('queue', item.id, item)
  await reload()
  return true
}

export async function discardQueued(id: string) {
  await kvDelete('queue', id)
  await reload()
}

/** Lets the person send an entry again after a refusal (for example once an admin fixed the permission). */
export async function retryQueued(id: string) {
  const item = snapshot.find((q) => q.id === id)
  if (!item) return
  await kvSet('queue', id, { ...item, error: undefined })
  await reload()
  void syncQueue()
}

async function resolveName(name: string, load: () => PromiseLike<{ data: Named[] | null }>, create: typeof createBank) {
  const clean = name.trim()
  if (!clean) return { id: null as string | null }
  const { data } = await load()
  if (!data) return { failed: true as const }
  const existing = data.find((n) => n.name.trim().toLowerCase() === clean.toLowerCase())
  if (existing) return { id: existing.id }
  const id = await create(clean)
  return id ? { id } : { failed: true as const }
}

type Outcome = 'sent' | 'later' | 'refused'

async function send(item: QueuedEntry): Promise<Outcome> {
  const contractor = await resolveName(item.contractorName, fetchContractorNames, createContractor)
  const bank = await resolveName(item.bankName, fetchBankNames, createBank)
  if ('failed' in contractor || 'failed' in bank) return 'later'
  const row = {
    ...item.row,
    contractor_id: contractor.id ?? item.row.contractor_id,
    bank_id: bank.id ?? item.row.bank_id,
  }
  const { error } = await insertEntry(row, item.advanceId, item.id)
  // the same id again means the first try did arrive (only its answer was lost)
  if (error && (error as { code?: string }).code !== '23505') {
    if (isNetworkError(error)) return 'later'
    const message = String((error as { message?: string }).message ?? '')
    // an expired sign-in is renewed by the client by itself: try again later
    if (/jwt|token/i.test(message)) return 'later'
    await kvSet('queue', item.id, { ...item, error: 'السيرفر رفض القيد ده. ممكن تحتاج صلاحية أو بيانات القيد ناقصة.' })
    return 'refused'
  }
  if (item.files.length) await uploadInvoices(item.id, item.files)
  await kvDelete('queue', item.id)
  return 'sent'
}

let running = false

/** Sends the waiting entries of the signed-in person, oldest first. Returns how many arrived. */
export async function syncQueue(): Promise<number> {
  if (running || !isOnline()) return 0
  running = true
  let sent = 0
  try {
    const userId = await currentUserId()
    if (!userId) return 0
    const waiting = (await kvValues<QueuedEntry>('queue'))
      .filter((q) => q.userId === userId && !q.error)
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
    for (const item of waiting) {
      const outcome = await send(item)
      if (outcome === 'later') break
      if (outcome === 'sent') sent += 1
    }
  } finally {
    running = false
    await reload()
  }
  if (sent) notifyDataChanged()
  return sent
}

/** Loads what is waiting and keeps trying: when the network returns, when the app is opened again, and every while. */
export function startSync(): () => void {
  void reload().then(syncQueue)
  const tick = () => void syncQueue()
  const onVisible = () => {
    if (document.visibilityState === 'visible') tick()
  }
  window.addEventListener('online', tick)
  document.addEventListener('visibilitychange', onVisible)
  const timer = window.setInterval(tick, 30_000)
  return () => {
    window.removeEventListener('online', tick)
    document.removeEventListener('visibilitychange', onVisible)
    window.clearInterval(timer)
  }
}
