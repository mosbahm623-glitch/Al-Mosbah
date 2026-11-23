import { supabase } from '../supabase'
import { fetchPaged } from '../core/paged'
import { toCents } from '../core/money'
import { STATUS } from '../core/status'

/** One piece of work a group of payments is spread over. */
export type WorkItem = { item: string; category: string; amount: number }

export type Distribution = {
  id: string
  project_id: string
  contractor_id: string
  created_at: string
  contractor: { name: string } | null
  items: (WorkItem & { id: string; position: number })[]
  entries: { entry_id: string; amount: number }[]
}

/** A payment as the contractor page shows it: an approved expense recorded under his name in a project. */
export type PaymentEntry = {
  id: string
  seq: number
  project_id: string
  category: string
  item: string | null
  amount: number
  entry_date: string
  notes: string | null
  bank: { name: string } | null
  project: { name: string } | null
}

const DIST_COLUMNS =
  'id,project_id,contractor_id,created_at,contractor:contractors(name),items:payment_distribution_items(id,item,category,amount,position),entries:payment_distribution_entries(entry_id,amount)'

/** Every distribution (optionally of one contractor or one project). Null on failure. */
export const fetchDistributions = (scope: { contractorId?: string; projectId?: string } = {}) =>
  fetchPaged<Distribution>((a, b) => {
    let q = supabase.from('payment_distributions').select(DIST_COLUMNS)
    if (scope.contractorId) q = q.eq('contractor_id', scope.contractorId)
    if (scope.projectId) q = q.eq('project_id', scope.projectId)
    return q.order('created_at').order('id').range(a, b).returns<Distribution[]>()
  })

/** A contractor's approved expense entries with their project, oldest first. Null on failure. */
export const fetchPaymentEntries = (contractorId: string) =>
  fetchPaged<PaymentEntry>((a, b) =>
    supabase
      .from('entries')
      .select('id,seq,project_id,category,item,amount,entry_date,notes,bank:bank_accounts(name),project:projects(name)')
      .eq('contractor_id', contractorId)
      .eq('kind', 'expense')
      .eq('status', STATUS.approved)
      .order('entry_date')
      .order('seq')
      .range(a, b)
      .returns<PaymentEntry[]>(),
  )

/** Spreads the chosen payments over work items, all in one step in the database. Returns an error, if any. */
export async function distributePayments(
  projectId: string,
  contractorId: string,
  entryIds: string[],
  items: WorkItem[],
) {
  const { error } = await supabase.rpc('distribute_payments', {
    p_project: projectId,
    p_contractor: contractorId,
    p_entries: entryIds,
    p_items: items.map((i) => ({ item: i.item.trim(), category: i.category.trim(), amount: i.amount })),
  })
  return { error }
}

/** Takes a distribution back: the payments show as payments again. */
export const undoDistribution = (id: string) => supabase.rpc('undo_payment_distribution', { p_id: id })

/** How much of each entry (in cents) is already spread over work. */
export function distributedCents(dists: Distribution[]) {
  const by = new Map<string, number>()
  for (const d of dists) for (const e of d.entries) by.set(e.entry_id, (by.get(e.entry_id) ?? 0) + toCents(e.amount))
  return by
}

/** What is still free to spread (cents) on an entry. Never below zero. */
export const freeCents = (entry: { id: string; amount: number }, by: Map<string, number>) =>
  Math.max(toCents(entry.amount) - (by.get(entry.id) ?? 0), 0)

/** Total of some amounts, in cents. */
export const sumCents = (xs: { amount: number }[]) => xs.reduce((s, x) => s + toCents(x.amount), 0)

/**
 * Reports by بند show the work instead of the payments it was spread over. Each spread entry loses the amount that was
 * spread, and the work items come in as rows of their own (same project, same contractor), so the total stays the same.
 * When only some of a distribution's entries are in `rows` (a date range), the work is cut by the same share.
 * `make` builds a work row from one of the payments it replaces.
 */
export function applyDistributions<T extends { id: string; amount: number }>(
  rows: T[],
  dists: Distribution[],
  make: (base: T, item: WorkItem & { id: string }, amount: number, dist: Distribution) => T,
): T[] {
  if (!dists.length) return rows
  const byId = new Map(rows.map((r) => [r.id, r]))
  const reduce = new Map<string, number>()
  const work: T[] = []
  for (const d of dists) {
    const inside = d.entries.filter((e) => byId.has(e.entry_id))
    const total = sumCents(d.entries)
    if (!inside.length || total <= 0) continue
    let used = 0
    for (const e of inside) {
      const have = toCents(byId.get(e.entry_id)!.amount) - (reduce.get(e.entry_id) ?? 0)
      const take = Math.min(toCents(e.amount), Math.max(have, 0))
      reduce.set(e.entry_id, (reduce.get(e.entry_id) ?? 0) + take)
      used += take
    }
    const base = byId.get(inside[0].entry_id)!
    const items = d.items.slice().sort((a, b) => a.position - b.position)
    let left = used
    items.forEach((it, i) => {
      const cents = i === items.length - 1 ? left : Math.min(Math.round((toCents(it.amount) * used) / total), left)
      left -= cents
      if (cents > 0) work.push(make(base, it, cents / 100, d))
    })
  }
  const kept = rows
    .map((r) => (reduce.has(r.id) ? { ...r, amount: (toCents(r.amount) - reduce.get(r.id)!) / 100 } : r))
    .filter((r) => !reduce.has(r.id) || toCents(r.amount) > 0)
  return [...kept, ...work]
}
