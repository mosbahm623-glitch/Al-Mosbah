import { supabase } from './supabase'
import { fetchPaged } from './paged'

export type LedgerTxn = {
  id: string
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
        .select('id,kind,amount,txn_date,notes,project:projects(name)')
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
  kind: 'due' | 'payment'
  amount: number
  txn_date: string
  contractor: { name: string } | null
}

/** Every contractor transaction, for the all-contractors summary. Null on failure. */
export const fetchAllContractorTxns = () =>
  fetchPaged<SummaryTxn>((a, b) =>
    supabase
      .from('contractor_transactions')
      .select('kind,amount,txn_date,contractor_id,contractor:contractors(name)')
      .order('id')
      .range(a, b)
      .returns<SummaryTxn[]>(),
  )
