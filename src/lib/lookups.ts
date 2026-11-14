import { supabase } from './supabase'
import { fetchPaged } from './paged'

export type Named = { id: string; name: string }

export const fetchContractorNames = () =>
  supabase.from('contractors').select('id,name').order('name').returns<Named[]>()
export type BankChoice = Named & { logo: string | null }
export const fetchBankNames = () =>
  supabase.from('bank_accounts').select('id,name,logo').order('name').returns<BankChoice[]>()
/** The banks the admin let this person choose from (ids). The database shows him only his own list. */
export async function fetchMyBankIds(userId: string): Promise<{ data: string[] | null; error: unknown }> {
  const { data, error } = await supabase.from('user_bank_access').select('bank_id').eq('user_id', userId)
  return error || !data ? { data: null, error } : { data: data.map((r) => r.bank_id), error: null }
}
export const fetchPeople = () =>
  supabase
    .from('profiles')
    .select('id,full_name')
    .order('full_name')
    .returns<{ id: string; full_name: string | null }[]>()
export const fetchProjectNames = () => supabase.from('projects').select('id,name').order('name').returns<Named[]>()

/** Which contractor worked on which project (by name): from his dues / payments and from expenses recorded under his name. Null on failure. */
export async function fetchProjectContractors(): Promise<Map<string, Set<string>> | null> {
  type Pair = { contractor: { name: string } | null; project: { name: string } | null }
  const [txns, entries] = await Promise.all([
    fetchPaged<Pair>((a, b) =>
      supabase
        .from('contractor_transactions')
        .select('contractor:contractors(name),project:projects(name)')
        .not('project_id', 'is', null)
        .order('id')
        .range(a, b)
        .returns<Pair[]>(),
    ),
    fetchPaged<Pair>((a, b) =>
      supabase
        .from('entries')
        .select('contractor:contractors(name),project:projects(name)')
        .not('contractor_id', 'is', null)
        .eq('status', 'approved')
        .order('id')
        .range(a, b)
        .returns<Pair[]>(),
    ),
  ])
  if (!txns || !entries) return null
  const by = new Map<string, Set<string>>()
  for (const r of [...txns, ...entries]) {
    if (!r.project || !r.contractor) continue
    const set = by.get(r.project.name) ?? new Set<string>()
    set.add(r.contractor.name)
    by.set(r.project.name, set)
  }
  return by
}
