import { fetchPaged } from './paged'
import { supabase } from './supabase'

export type ContractorTxn = { id: string; kind: 'due' | 'payment'; amount: number; txn_date: string; notes: string | null; project: { name: string } | null }
export type ContractorSpent = { id: string; seq: number; category: string; item: string | null; amount: number; entry_date: string; project: { name: string } | null }

/** One contractor's dues and payments, plus the approved entries recorded under his name. */
export async function fetchContractorLedger(contractorId: string) {
  const [txns, spent] = await Promise.all([
    fetchPaged<ContractorTxn>((a, b) =>
      supabase.from('contractor_transactions').select('id,kind,amount,txn_date,notes,project:projects(name)').eq('contractor_id', contractorId).order('txn_date').order('id').range(a, b).returns<ContractorTxn[]>(),
    ),
    fetchPaged<ContractorSpent>((a, b) =>
      supabase.from('entries').select('id,seq,category,item,amount,entry_date,project:projects(name)').eq('contractor_id', contractorId).eq('status', 'approved').order('entry_date').order('id').range(a, b).returns<ContractorSpent[]>(),
    ),
  ])
  return { data: txns && spent ? { txns, spent } : null, error: !txns || !spent }
}

export type ContractorSummaryTxn = { kind: 'due' | 'payment'; amount: number; txn_date: string; contractor: { name: string } | null }

/** Every contractor transaction (for the all-contractors summary). */
export async function fetchAllContractorTxns() {
  const txns = await fetchPaged<ContractorSummaryTxn>((a, b) =>
    supabase.from('contractor_transactions').select('kind,amount,txn_date,contractor_id,contractor:contractors(name)').order('id').range(a, b).returns<ContractorSummaryTxn[]>(),
  )
  return { data: txns, error: !txns }
}
