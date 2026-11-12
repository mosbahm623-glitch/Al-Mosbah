import { supabase } from './supabase'

/** Asks the AI function to read a sentence. `data` holds its answer; it is empty when the function is unreachable. */
export const askAssistant = (body: { text: string; projects: { id: string; name: string }[]; categories: string[] }) =>
  supabase.functions.invoke('assistant', { body })

export const fetchContractorNames = () =>
  supabase.from('contractors').select('id,name').order('name').returns<{ id: string; name: string }[]>()
