import { supabase } from './supabase'
import { addMoney, subMoney } from './money'

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
export const bankBalance = (b: Pick<BankSummary, 'opening_balance' | 'income' | 'expenses'>) => subMoney(addMoney(b.opening_balance, b.income), b.expenses)

export const fetchBankSummaries = () => supabase.rpc('bank_summaries')
export const fetchBankMovements = (bankId: string) => supabase.rpc('bank_movements', { p_bank: bankId })

/** Per-project in / out of one bank. */
export function byProject(rows: BankMovement[]) {
  const map = new Map<string, { id: string; name: string; income: number; expenses: number }>()
  for (const m of rows) {
    const p = map.get(m.project_id) ?? { id: m.project_id, name: m.project_name, income: 0, expenses: 0 }
    if (m.kind === 'income') p.income = addMoney(p.income, m.amount)
    else p.expenses = addMoney(p.expenses, m.amount)
    map.set(m.project_id, p)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

export type SaveBankResult = 'ok' | 'duplicate' | 'failed'

/** New bank (no `id`) or rename / change the opening balance. */
export async function saveBank(input: { id?: string; name: string; opening_balance: number }): Promise<SaveBankResult> {
  const row = { name: input.name, opening_balance: input.opening_balance }
  const { error } = input.id ? await supabase.from('bank_accounts').update(row).eq('id', input.id) : await supabase.from('bank_accounts').insert(row)
  if (!error) return 'ok'
  return error.code === '23505' ? 'duplicate' : 'failed'
}
