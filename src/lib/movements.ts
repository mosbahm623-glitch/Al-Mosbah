import { supabase } from './supabase'

export type MovementKind = 'income' | 'expense' | 'installment' | 'return' | 'due' | 'payment'

export const KIND_LABEL: Record<MovementKind, string> = {
  income: 'وارد',
  expense: 'مصروف',
  installment: 'دفعة عهدة',
  return: 'مرتجع عهدة',
  due: 'مستحق مقاول',
  payment: 'دفعة مقاول',
}

export type Movement = {
  key: string
  kind: MovementKind
  date: string
  /** when it was recorded; orders "latest" movements */
  at: string
  amount: number
  /** project, custody holder or contractor the line is about */
  /** البند: the expense category (entries only) */
  category: string | null
  /** البيان: the expense name for entries; the holder or contractor for custody and contractor lines */
  title: string
  project: string | null
  party: string | null
  detail: string | null
  notes: string | null
  seq: number | null
  /** expense paid out of a custody: shown, but not counted again (the installments are) */
  fromAdvance: boolean
  status: 'pending' | 'approved' | 'rejected'
}

type EntryRow = {
  id: string; seq: number; kind: 'income' | 'expense'; category: string; item: string | null; amount: number
  entry_date: string; created_at: string; notes: string | null; advance_id: string | null
  status: 'pending' | 'approved' | 'rejected'
  project: { name: string } | null; contractor: { name: string } | null; bank: { name: string } | null
}
type InstallmentRow = { id: string; amount: number; paid_on: string; created_at: string; advance: { holder_name: string } | null }
type ReturnRow = { id: string; amount: number; returned_on: string; created_at: string; notes: string | null; advance: { holder_name: string } | null }
type TxnRow = {
  id: string; kind: 'due' | 'payment'; amount: number; txn_date: string; created_at: string; notes: string | null
  contractor: { name: string } | null; project: { name: string } | null
}

export const fromEntry = (e: EntryRow): Movement => ({
  key: `e-${e.id}`,
  kind: e.kind,
  date: e.entry_date,
  at: e.created_at,
  amount: e.amount,
  category: e.category,
  title: e.item ?? '',
  project: e.project?.name ?? null,
  party: e.contractor?.name ?? null,
  detail: e.bank?.name ?? null,
  notes: e.notes,
  seq: e.seq,
  fromAdvance: e.advance_id !== null,
  status: e.status,
})

export const fromInstallment = (r: InstallmentRow): Movement => ({
  key: `i-${r.id}`, kind: 'installment', date: r.paid_on, at: r.created_at, amount: r.amount,
  category: null, title: r.advance?.holder_name ?? 'عهدة', project: null, party: r.advance?.holder_name ?? null, detail: null, notes: null,
  seq: null, fromAdvance: false, status: 'approved',
})

export const fromReturn = (r: ReturnRow): Movement => ({
  key: `r-${r.id}`, kind: 'return', date: r.returned_on, at: r.created_at, amount: r.amount,
  category: null, title: r.advance?.holder_name ?? 'عهدة', project: null, party: r.advance?.holder_name ?? null, detail: null, notes: r.notes,
  seq: null, fromAdvance: false, status: 'approved',
})

export const fromTxn = (t: TxnRow): Movement => ({
  key: `t-${t.id}`, kind: t.kind, date: t.txn_date, at: t.created_at, amount: t.amount,
  category: null, title: t.contractor?.name ?? 'مقاول', project: t.project?.name ?? null, party: t.contractor?.name ?? null, detail: null, notes: t.notes,
  seq: null, fromAdvance: false, status: 'approved',
})

const ENTRY_SELECT =
  'id,seq,kind,category,item,amount,entry_date,created_at,notes,advance_id,status,project:projects(name),contractor:contractors(name),bank:bank_accounts(name)'
const INSTALLMENT_SELECT = 'id,amount,paid_on,created_at,advance:advances(holder_name)'
const RETURN_SELECT = 'id,amount,returned_on,created_at,notes,advance:advances(holder_name)'
const TXN_SELECT = 'id,kind,amount,txn_date,created_at,notes,contractor:contractors(name),project:projects(name)'

type Scope = { day: string } | { latest: number }

/** Every kind of money movement, from the five tables, as one list (newest first). */
export async function fetchMovements(scope: Scope): Promise<Movement[] | null> {
  const day = 'day' in scope ? scope.day : null
  const n = 'latest' in scope ? scope.latest : 0

  let entries = supabase.from('entries').select(ENTRY_SELECT)
  let installments = supabase.from('advance_installments').select(INSTALLMENT_SELECT)
  let returns = supabase.from('advance_returns').select(RETURN_SELECT)
  let txns = supabase.from('contractor_transactions').select(TXN_SELECT)
  if (day) {
    // a day's journal only has approved entries, like the reports
    entries = entries.eq('entry_date', day).eq('status', 'approved')
    installments = installments.eq('paid_on', day)
    returns = returns.eq('returned_on', day)
    txns = txns.eq('txn_date', day)
  } else {
    entries = entries.order('created_at', { ascending: false }).limit(n)
    installments = installments.order('created_at', { ascending: false }).limit(n)
    returns = returns.order('created_at', { ascending: false }).limit(n)
    txns = txns.order('created_at', { ascending: false }).limit(n)
  }
  const [a, b, c, d] = await Promise.all([
    entries.returns<EntryRow[]>(),
    installments.returns<InstallmentRow[]>(),
    returns.returns<ReturnRow[]>(),
    txns.returns<TxnRow[]>(),
  ])
  if (a.error || b.error || c.error || d.error) return null
  const all = [
    ...(a.data ?? []).map(fromEntry),
    ...(b.data ?? []).map(fromInstallment),
    ...(c.data ?? []).map(fromReturn),
    ...(d.data ?? []).map(fromTxn),
  ]
  return sortMovements(all).slice(0, day ? undefined : n)
}

/** Newest recorded first; entries of the same moment keep their serial order. */
export const sortMovements = (rows: Movement[]) =>
  [...rows].sort((x, y) => y.at.localeCompare(x.at) || (y.seq ?? 0) - (x.seq ?? 0))

export type DayTotals = Record<MovementKind, number> & {
  /** expense entries not paid from a custody (those are counted through the installments) */
  cashExpense: number
  count: number
}

const cents = (n: number) => Math.round(n * 100)

export function totalsOfDay(rows: Movement[]): DayTotals {
  const sums: Record<MovementKind, number> = { income: 0, expense: 0, installment: 0, return: 0, due: 0, payment: 0 }
  let cashExpense = 0
  for (const m of rows) {
    sums[m.kind] += cents(m.amount)
    if (m.kind === 'expense' && !m.fromAdvance) cashExpense += cents(m.amount)
  }
  return {
    income: sums.income / 100,
    expense: sums.expense / 100,
    installment: sums.installment / 100,
    return: sums.return / 100,
    due: sums.due / 100,
    payment: sums.payment / 100,
    cashExpense: cashExpense / 100,
    count: rows.length,
  }
}

/** Money coming in (+) or going out (−) of the company for the sign next to an amount. */
export const direction = (m: Movement): 'in' | 'out' | 'neutral' => {
  if (m.kind === 'income' || m.kind === 'return') return 'in'
  if (m.kind === 'expense') return m.fromAdvance ? 'neutral' : 'out'
  if (m.kind === 'installment' || m.kind === 'payment') return 'out'
  return 'neutral'
}

export const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
