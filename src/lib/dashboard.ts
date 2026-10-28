import { supabase } from './supabase'

type BudgetRow = { id: string; name: string; budget: number; spent: number; over: boolean }

export type DashboardSummary = {
  total_income: number
  total_expenses: number
  total_advances: number
  advances_balance: number
  contractor_dues: number
  active_projects: number
  net_cash: number
  over_count: number
  budget_rows: BudgetRow[]
}

export const fetchDashboardSummary = () => supabase.rpc('dashboard_summary')
