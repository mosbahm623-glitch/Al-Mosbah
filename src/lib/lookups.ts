import { supabase } from './supabase'

export type Named = { id: string; name: string }

export const fetchContractorNames = () => supabase.from('contractors').select('id,name').order('name').returns<Named[]>()
export const fetchBankNames = () => supabase.from('bank_accounts').select('id,name').order('name').returns<Named[]>()
export const fetchPeople = () => supabase.from('profiles').select('id,full_name').order('full_name').returns<{ id: string; full_name: string | null }[]>()
