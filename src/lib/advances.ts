import { supabase } from './supabase'
import { ENTRY_COLUMNS, type Entry } from './projects'

export type AdvanceSummary = {
  id: string
  holder_name: string
  status: 'open' | 'closed'
  notes: string | null
  given: number
  spent: number
  returned: number
}

export type Installment = { id: string; amount: number; paid_on: string }
export type AdvanceReturn = { id: string; amount: number; returned_on: string; notes: string | null }

/** What the holder still has: received − spent − returned (negative = the company owes him). */
export const advanceBalance = (a: Pick<AdvanceSummary, 'given' | 'spent' | 'returned'>) =>
  a.given - a.spent - a.returned

export const fetchAdvanceSummaries = () => supabase.rpc('advance_summaries')

export const fetchInstallments = (advanceId: string) =>
  supabase
    .from('advance_installments')
    .select('id,amount,paid_on')
    .eq('advance_id', advanceId)
    .order('paid_on', { ascending: false })
    .returns<Installment[]>()

export const fetchReturns = (advanceId: string) =>
  supabase
    .from('advance_returns')
    .select('id,amount,returned_on,notes')
    .eq('advance_id', advanceId)
    .order('returned_on', { ascending: false })
    .returns<AdvanceReturn[]>()

export const fetchAdvanceEntries = (advanceId: string) =>
  supabase
    .from('entries')
    .select(`${ENTRY_COLUMNS},project_id,project:projects(name)`)
    .eq('advance_id', advanceId)
    .order('seq', { ascending: false })
    .returns<Entry[]>()
