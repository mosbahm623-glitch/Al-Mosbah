import { supabase } from './supabase'

export type Named = { id: string; name: string }

export const fetchContractorNames = () => supabase.from('contractors').select('id,name').order('name').returns<Named[]>()
export const fetchBankNames = () => supabase.from('bank_accounts').select('id,name').order('name').returns<Named[]>()
export const fetchPeople = () => supabase.from('profiles').select('id,full_name').order('full_name').returns<{ id: string; full_name: string | null }[]>()

/** New contractor by name. Returns its id, or null if it could not be saved. */
export async function createContractor(name: string) {
  const { data, error } = await supabase.from('contractors').insert({ name }).select('id').single()
  return error || !data ? null : data.id
}

/** New bank account by name (opening balance 0). Returns its id, or null if it could not be saved. */
export async function createBank(name: string) {
  const { data, error } = await supabase.from('bank_accounts').insert({ name }).select('id').single()
  return error || !data ? null : data.id
}
