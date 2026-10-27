import { supabase } from './supabase'

export type BankSummary = { id: string; name: string; opening_balance: number; income: number; expenses: number }

export type BankMovement = {
  id: string
  seq: number
  kind: 'income' | 'expense'
  entry_date: string
  category: string
  item: string | null
  notes: string | null
  amount: number
  project_id: string
  project_name: string
  contractor: string | null
}

/** Current balance = opening + money in − money out. */
export const bankBalance = (b: Pick<BankSummary, 'opening_balance' | 'income' | 'expenses'>) => b.opening_balance + b.income - b.expenses

export const fetchBankSummaries = () => supabase.rpc('bank_summaries')
export const fetchBankMovements = (bankId: string) => supabase.rpc('bank_movements', { p_bank: bankId })

/** Per-project in / out of one bank. */
export function byProject(rows: BankMovement[]) {
  const map = new Map<string, { id: string; name: string; income: number; expenses: number }>()
  for (const m of rows) {
    const p = map.get(m.project_id) ?? { id: m.project_id, name: m.project_name, income: 0, expenses: 0 }
    if (m.kind === 'income') p.income += m.amount
    else p.expenses += m.amount
    map.set(m.project_id, p)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}
