import { supabase } from './supabase'
import { fetchPaged } from './paged'
import { toCents } from './money'

export type LedgerTxn = {
  id: string
  project_id: string | null
  kind: 'due' | 'payment'
  amount: number
  txn_date: string
  notes: string | null
  project: { name: string } | null
}
export type Spent = {
  id: string
  seq: number
  category: string
  item: string | null
  amount: number
  entry_date: string
  project: { name: string } | null
}

/** One contractor's dues and payments, and the approved expenses recorded under his name. Null on failure. */
export async function fetchContractorLedger(contractorId: string) {
  const [txns, spent] = await Promise.all([
    fetchPaged<LedgerTxn>((a, b) =>
      supabase
        .from('contractor_transactions')
        .select('id,project_id,kind,amount,txn_date,notes,project:projects(name)')
        .eq('contractor_id', contractorId)
        .order('txn_date')
        .order('id')
        .range(a, b)
        .returns<LedgerTxn[]>(),
    ),
    fetchPaged<Spent>((a, b) =>
      supabase
        .from('entries')
        .select('id,seq,category,item,amount,entry_date,project:projects(name)')
        .eq('contractor_id', contractorId)
        .eq('status', 'approved')
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
  contractor: { name: string } | null
  project: { name: string } | null
}

/** Every contractor transaction, for the all-contractors summary. Null on failure. */
export const fetchAllContractorTxns = () =>
  fetchPaged<SummaryTxn>((a, b) =>
    supabase
      .from('contractor_transactions')
      .select('kind,amount,txn_date,contractor_id,contractor:contractors(name),project:projects(name)')
      .order('id')
      .range(a, b)
      .returns<SummaryTxn[]>(),
  )

export type ContractorRow = { id: string; name: string; due: number; paid: number; spent: number }

/** What we owe each contractor (dues − payments) next to what was spent under his name. */
export async function fetchContractorSummaries(): Promise<{ data: ContractorRow[] | null; error: unknown }> {
  const [people, txns, spent] = await Promise.all([
    supabase.from('contractors').select('id,name').order('name').returns<{ id: string; name: string }[]>(),
    fetchAllContractorTxns(),
    // spending is shown for information only, so a user who cannot see entries just gets zeros
    fetchPaged<{ contractor_id: string; amount: number }>((a, b) =>
      supabase
        .from('entries')
        .select('contractor_id,amount')
        .not('contractor_id', 'is', null)
        .eq('status', 'approved')
        .order('id')
        .range(a, b)
        .returns<{ contractor_id: string; amount: number }[]>(),
    ),
  ])
  if (people.error || !people.data || !txns) return { data: null, error: people.error ?? true }
  const by = new Map<string, { due: number; paid: number; spent: number }>()
  const slot = (id: string) => {
    const v = by.get(id) ?? { due: 0, paid: 0, spent: 0 }
    by.set(id, v)
    return v
  }
  for (const t of txns) slot(t.contractor_id)[t.kind === 'due' ? 'due' : 'paid'] += toCents(t.amount)
  for (const e of spent ?? []) slot(e.contractor_id).spent += toCents(e.amount)
  return {
    data: people.data.map((c) => {
      const v = by.get(c.id) ?? { due: 0, paid: 0, spent: 0 }
      return { id: c.id, name: c.name, due: v.due / 100, paid: v.paid / 100, spent: v.spent / 100 }
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

/** A new due / payment, or (with an id) an edit of an existing one. */
export const saveContractorTxn = (row: TxnInput, id?: string) =>
  id
    ? supabase.from('contractor_transactions').update(row).eq('id', id)
    : supabase.from('contractor_transactions').insert(row)

export const deleteContractorTxn = (id: string) => supabase.from('contractor_transactions').delete().eq('id', id)
