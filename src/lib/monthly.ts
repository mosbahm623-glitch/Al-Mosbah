import { supabase } from './supabase'
import { sumMoney } from './money'

export type MonthRow = { month: string; income: number; expenses: number }
type Line = { kind: 'income' | 'expense'; amount: number; entry_date: string }

/** The last `count` months (oldest first, `YYYY-MM`) ending at the month of `today`. */
export function lastMonths(today: string, count: number): string[] {
  const [y, m] = today.split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1))
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

/** Income and expenses per month (approved entries), one row for every month asked for, even with no movement. */
export function monthlyTotals(lines: Line[], months: string[]): MonthRow[] {
  return months.map((month) => {
    const inMonth = lines.filter((l) => l.entry_date.startsWith(month))
    return {
      month,
      income: sumMoney(inMonth.filter((l) => l.kind === 'income').map((l) => l.amount)),
      expenses: sumMoney(inMonth.filter((l) => l.kind === 'expense').map((l) => l.amount)),
    }
  })
}

/** Approved entries from the first day of the oldest month on. */
export async function fetchMonthly(today: string, count = 6): Promise<{ data: MonthRow[] | null; error: unknown }> {
  const months = lastMonths(today, count)
  const { data, error } = await supabase
    .from('entries')
    .select('kind,amount,entry_date')
    .eq('status', 'approved')
    .gte('entry_date', `${months[0]}-01`)
    .limit(10000)
    .returns<Line[]>()
  return error || !data ? { data: null, error } : { data: monthlyTotals(data, months), error: null }
}
