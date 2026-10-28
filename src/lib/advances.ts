import { supabase } from './supabase'
import { ENTRY_COLUMNS, type Entry } from './projects'
import { subMoney } from './money'

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
export const advanceBalance = (a: Pick<AdvanceSummary, 'given' | 'spent' | 'returned'>) => subMoney(subMoney(a.given, a.spent), a.returned)

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

export type SaveAdvanceResult = 'ok' | 'failed' | 'installment-failed'

/**
 * Creates a custody (with an optional first installment) or edits its holder and notes.
 * 'installment-failed' means the custody itself was created but the first installment was not.
 */
export async function saveAdvance(input: { id?: string; holder: string; notes: string | null; first: number; date: string }): Promise<SaveAdvanceResult> {
  const row = { holder_name: input.holder, notes: input.notes }
  if (input.id) {
    const { error } = await supabase.from('advances').update(row).eq('id', input.id)
    return error ? 'failed' : 'ok'
  }
  const { data, error } = await supabase.from('advances').insert(row).select('id').single()
  if (error || !data) return 'failed'
  if (input.first > 0) {
    const { error: instErr } = await supabase.from('advance_installments').insert({ advance_id: data.id, amount: input.first, paid_on: input.date })
    if (instErr) return 'installment-failed'
  }
  return 'ok'
}

export async function setAdvanceStatus(id: string, status: AdvanceSummary['status']) {
  const { error } = await supabase.from('advances').update({ status }).eq('id', id)
  return !error
}

/** Money handed to the holder (`installment`) or given back by him (`return`). */
export type MoneyKind = 'installment' | 'return'

/** Adds (no `id`) or edits one installment / return. `notes` is kept for returns only. */
export async function saveAdvanceMoney(kind: MoneyKind, advanceId: string, input: { id?: string; amount: number; date: string; notes: string | null }) {
  if (kind === 'installment') {
    const values = { amount: input.amount, paid_on: input.date }
    const { error } = input.id
      ? await supabase.from('advance_installments').update(values).eq('id', input.id)
      : await supabase.from('advance_installments').insert({ ...values, advance_id: advanceId })
    return !error
  }
  const values = { amount: input.amount, returned_on: input.date, notes: input.notes }
  const { error } = input.id
    ? await supabase.from('advance_returns').update(values).eq('id', input.id)
    : await supabase.from('advance_returns').insert({ ...values, advance_id: advanceId })
  return !error
}

export async function deleteAdvanceMoney(kind: MoneyKind, id: string) {
  const { error } = kind === 'installment' ? await supabase.from('advance_installments').delete().eq('id', id) : await supabase.from('advance_returns').delete().eq('id', id)
  return !error
}
