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

export type AdvanceInput = { holder_name: string; notes: string | null }

export const updateAdvance = (id: string, row: AdvanceInput) => supabase.from('advances').update(row).eq('id', id)

export const createAdvance = (row: AdvanceInput) => supabase.from('advances').insert(row).select('id').single()

export const setAdvanceStatus = (id: string, status: AdvanceSummary['status']) =>
  supabase.from('advances').update({ status }).eq('id', id)

export const addInstallment = (advanceId: string, amount: number, paidOn: string) =>
  supabase.from('advance_installments').insert({ advance_id: advanceId, amount, paid_on: paidOn })

/** installments: money handed to the holder · returns: money the holder gave back */
export type MoneyKind = 'installment' | 'return'
const MONEY_TABLE = { installment: 'advance_installments', return: 'advance_returns' } as const

/** Adds a row (no `rowId`) or edits one. `values` holds the amount, the date column and, for returns, the notes. */
export const saveAdvanceMoney = (
  kind: MoneyKind,
  advanceId: string,
  values: Record<string, unknown>,
  rowId?: string,
) =>
  rowId
    ? supabase
        .from(MONEY_TABLE[kind])
        .update(values as never)
        .eq('id', rowId)
    : supabase.from(MONEY_TABLE[kind]).insert({ ...values, advance_id: advanceId } as never)

export const deleteAdvanceMoney = (kind: MoneyKind, rowId: string) =>
  supabase.from(MONEY_TABLE[kind]).delete().eq('id', rowId)
