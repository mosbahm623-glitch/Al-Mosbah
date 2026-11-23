import { supabase } from '../supabase'
import { fetchPaged } from '../core/paged'
import { toCents } from '../core/money'
import { STATUS } from '../core/status'

export type DueItem = { id?: string; item: string; category: string | null; amount: number }
export type LedgerTxn = {
  id: string
  project_id: string | null
  kind: 'due' | 'payment'
  amount: number
  txn_date: string
  notes: string | null
  project: { name: string } | null
  items: (DueItem & { position: number })[]
}
export type Spent = {
  id: string
  seq: number
  project_id: string
  category: string
  item: string | null
  amount: number
  entry_date: string
  project: { name: string; status: string } | null
}

/** One contractor's dues and payments, and the approved expenses recorded under his name. Null on failure. */
export async function fetchContractorLedger(contractorId: string) {
  const [txns, spent] = await Promise.all([
    fetchPaged<LedgerTxn>((a, b) =>
      supabase
        .from('contractor_transactions')
        .select(
          'id,project_id,kind,amount,txn_date,notes,project:projects(name),items:contractor_due_items(id,item,category,amount,position)',
        )
        .eq('contractor_id', contractorId)
        .order('txn_date')
        .order('id')
        .range(a, b)
        .returns<LedgerTxn[]>(),
    ),
    fetchPaged<Spent>((a, b) =>
      supabase
        .from('entries')
        .select('id,seq,project_id,category,item,amount,entry_date,project:projects(name,status)')
        .eq('contractor_id', contractorId)
        .eq('status', STATUS.approved)
        .order('entry_date')
        .order('id')
        .range(a, b)
        .returns<Spent[]>(),
    ),
  ])
  return txns && spent ? { txns, spent } : null
}

export type SummaryTxn = {
  contractor_id: string
  kind: 'due' | 'payment'
  amount: number
  txn_date: string
  project_id: string | null
  contractor: { name: string } | null
  project: { name: string } | null
}

/** Every contractor transaction, for the all-contractors summary. Null on failure. */
export const fetchAllContractorTxns = () =>
  fetchPaged<SummaryTxn>((a, b) =>
    supabase
      .from('contractor_transactions')
      .select('kind,amount,txn_date,contractor_id,project_id,contractor:contractors(name),project:projects(name)')
      .order('id')
      .range(a, b)
      .returns<SummaryTxn[]>(),
  )

/** `paid` and `left` count only the projects that have a due; `spent` is everything recorded under his name. */
export type ContractorRow = { id: string; name: string; due: number; paid: number; spent: number; left: number }

/**
 * What we owe each contractor, project by project: dues minus payments, where a payment is a ledger payment or an
 * approved expense entry under his name. Projects without a due do not count towards what is owed (nothing to measure
 * the payments against); `spent` is everything recorded under his name, shown for information.
 */
export async function fetchContractorSummaries(): Promise<{ data: ContractorRow[] | null; error: unknown }> {
  const [people, txns, spent] = await Promise.all([
    supabase.from('contractors').select('id,name').order('name').returns<{ id: string; name: string }[]>(),
    fetchAllContractorTxns(),
    // spending is shown for information only, so a user who cannot see entries just gets zeros
    fetchPaged<{ contractor_id: string; project_id: string; amount: number }>((a, b) =>
      supabase
        .from('entries')
        .select('contractor_id,project_id,amount')
        .not('contractor_id', 'is', null)
        .eq('status', STATUS.approved)
        .order('id')
        .range(a, b)
        .returns<{ contractor_id: string; project_id: string; amount: number }[]>(),
    ),
  ])
  if (people.error || !people.data || !txns) return { data: null, error: people.error ?? true }
  type Acc = { due: number; paid: number }
  const by = new Map<string, Map<string, Acc>>()
  const slot = (contractor: string, project: string | null) => {
    const projects = by.get(contractor) ?? new Map<string, Acc>()
    by.set(contractor, projects)
    const acc = projects.get(project ?? 'none') ?? { due: 0, paid: 0 }
    projects.set(project ?? 'none', acc)
    return acc
  }
  const spentBy = new Map<string, number>()
  for (const t of txns) slot(t.contractor_id, t.project_id)[t.kind === 'due' ? 'due' : 'paid'] += toCents(t.amount)
  for (const e of spent ?? []) {
    slot(e.contractor_id, e.project_id).paid += toCents(e.amount)
    spentBy.set(e.contractor_id, (spentBy.get(e.contractor_id) ?? 0) + toCents(e.amount))
  }
  return {
    data: people.data.map((c) => {
      let due = 0
      let paid = 0
      for (const acc of by.get(c.id)?.values() ?? []) {
        if (acc.due === 0) continue
        due += acc.due
        paid += acc.paid
      }
      return {
        id: c.id,
        name: c.name,
        due: due / 100,
        paid: paid / 100,
        spent: (spentBy.get(c.id) ?? 0) / 100,
        left: (due - paid) / 100,
      }
    }),
    error: null,
  }
}

export type TxnInput = {
  contractor_id: string
  kind: 'due' | 'payment'
  amount: number
  txn_date: string
  project_id: string | null
  notes: string | null
}

/** Total of a due's work items, in money (cents-safe). */
export const itemsTotal = (items: { amount: number }[]) => items.reduce((s, i) => s + toCents(i.amount), 0) / 100

/**
 * A new due / payment, or (with an id) an edit of an existing one. A due may carry work items:
 * they replace the old ones and `amount` is kept equal to their total. Returns an error, if any.
 */
export async function saveContractorTxn(row: TxnInput, id?: string, items?: DueItem[]) {
  const amount = items?.length ? itemsTotal(items) : row.amount
  const saved = id
    ? await supabase
        .from('contractor_transactions')
        .update({ ...row, amount })
        .eq('id', id)
        .select('id')
        .single()
    : await supabase
        .from('contractor_transactions')
        .insert({ ...row, amount })
        .select('id')
        .single()
  if (saved.error || !saved.data) return { error: saved.error ?? true }
  if (items === undefined) return { error: null }
  const txn = saved.data.id as string
  if (id) {
    const del = await supabase.from('contractor_due_items').delete().eq('transaction_id', txn)
    if (del.error) return { error: del.error }
  }
  if (!items.length) return { error: null }
  const ins = await supabase.from('contractor_due_items').insert(
    items.map((i, position) => ({
      transaction_id: txn,
      item: i.item,
      category: i.category,
      amount: i.amount,
      position,
    })),
  )
  return { error: ins.error }
}

export const deleteContractorTxn = (id: string) => supabase.from('contractor_transactions').delete().eq('id', id)

export type MergeResult = { entries: number; transactions: number; settlements: number }

/** Admin only: moves everything of the `drop` contractors to `keep` and removes the extra names. Null on failure. */
export async function mergeContractors(keep: string, drop: string[]): Promise<MergeResult | null> {
  const { data, error } = await supabase.rpc('merge_contractors', { p_keep: keep, p_drop: drop })
  return error || !data ? null : (data as MergeResult)
}
