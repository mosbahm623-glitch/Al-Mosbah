import { supabase } from './supabase'

export type Category = { id: string; name: string; expense_items: { id: string; name: string }[] }

/** Expense categories (البنود) with the names (البيان) used under each. */
export const fetchCategories = () =>
  supabase.from('expense_categories').select('id,name,expense_items(id,name)').order('name')

/** Each `create…` returns the new id, or null when it could not be saved. */
export async function createCategory(name: string) {
  const { data, error } = await supabase.from('expense_categories').insert({ name }).select('id').single()
  return error || !data ? null : (data.id as string)
}

export async function createContractor(name: string) {
  const { data, error } = await supabase.from('contractors').insert({ name }).select('id').single()
  return error || !data ? null : (data.id as string)
}

export async function createBank(name: string) {
  const { data, error } = await supabase.from('bank_accounts').insert({ name }).select('id').single()
  return error || !data ? null : (data.id as string)
}

/** Remembers an expense name under its category so it shows up as a suggestion next time. */
export const addExpenseItem = (name: string, categoryId: string) =>
  supabase.from('expense_items').insert({ name, category_id: categoryId })
