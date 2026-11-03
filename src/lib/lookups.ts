import { supabase } from './supabase'

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
