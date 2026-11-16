import { supabase } from './supabase'

export type BankSummary = {
  id: string
  name: string
  logo: string | null
  opening_balance: number
  income: number
  expenses: number
}

export type BankMovement = {
  id: string
  /** null for a custody payment (it has no entry number) */
  seq: number | null
  kind: 'income' | 'expense'
  entry_date: string
  category: string
  item: string | null
  notes: string | null
  amount: number
  /** null for a custody payment, shown under "عهد" */
  project_id: string | null
  project_name: string
  contractor: string | null
}

/** Current balance = opening + money in − money out. */
export const bankBalance = (b: Pick<BankSummary, 'opening_balance' | 'income' | 'expenses'>) =>
  b.opening_balance + b.income - b.expenses

/** Banks that stay off the dashboard card (the catch-all «أخرى»). */
const HIDDEN_ON_DASHBOARD = ['أخرى']

/** The banks the dashboard shows, biggest balance first, with their total. */
export function dashboardBanks(list: BankSummary[]) {
  const banks = list
    .filter((b) => !HIDDEN_ON_DASHBOARD.includes(b.name.trim()))
    .map((b) => ({ id: b.id, name: b.name, logo: b.logo, balance: bankBalance(b) }))
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, 'ar'))
  return { banks, total: banks.reduce((sum, b) => sum + b.balance, 0) }
}

export const fetchBankSummaries = () => supabase.rpc('bank_summaries').returns<BankSummary[]>()
export const fetchBankMovements = (bankId: string) =>
  supabase.rpc('bank_movements', { p_bank: bankId }).returns<BankMovement[]>()

export type BankInput = { name: string; opening_balance: number }

/** A new bank account, or (with an id) an edit of an existing one. */
export const saveBank = (row: BankInput, id?: string) =>
  id ? supabase.from('bank_accounts').update(row).eq('id', id) : supabase.from('bank_accounts').insert(row)

/** Per-project in / out of one bank. */
export function byProject(rows: BankMovement[]) {
  const map = new Map<string, { id: string; name: string; income: number; expenses: number }>()
  for (const m of rows) {
    const key = m.project_id ?? ''
    const p = map.get(key) ?? { id: key, name: m.project_name, income: 0, expenses: 0 }
    if (m.kind === 'income') p.income += m.amount
    else p.expenses += m.amount
    map.set(key, p)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}

export type BankToday = Record<string, { income: number; expenses: number }>

/** Approved money in and out today, per bank (entries and custody payments). */
export async function fetchBankToday(day: string) {
  const [entries, payments] = await Promise.all([
    supabase
      .from('entries')
      .select('bank_id,kind,amount')
      .eq('entry_date', day)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .returns<{ bank_id: string | null; kind: 'income' | 'expense'; amount: number }[]>(),
    supabase
      .from('advance_installments')
      .select('bank_id,amount')
      .eq('paid_on', day)
      .eq('status', 'approved')
      .returns<{ bank_id: string | null; amount: number }[]>(),
  ])
  if (entries.error || payments.error) return { data: null, error: entries.error ?? payments.error }
  const out: BankToday = {}
  const add = (id: string | null, key: 'income' | 'expenses', amount: number) => {
    if (!id) return
    out[id] ??= { income: 0, expenses: 0 }
    out[id][key] += Number(amount)
  }
  for (const e of entries.data ?? []) add(e.bank_id, e.kind === 'income' ? 'income' : 'expenses', e.amount)
  for (const p of payments.data ?? []) add(p.bank_id, 'expenses', p.amount)
  return { data: out, error: null }
}
