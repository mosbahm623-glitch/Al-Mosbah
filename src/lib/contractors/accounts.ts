import { toCents } from '../core/money'
import type { LedgerTxn, Spent } from './contractors'

type AccountLine = {
  key: string
  kind: 'due' | 'payment'
  date: string
  amount: number
  /** the ledger line behind it (editable); absent for a payment that comes from an expense entry */
  txn?: LedgerTxn
  /** the expense entry behind it */
  entry?: Spent
  /** running balance inside the project (dues − payments); null when the project has no due to measure against */
  run: number | null
}

export type ProjectAccount = {
  key: string
  name: string
  due: number
  paid: number
  hasDue: boolean
  /** what is still owed in this project; 0 when it has no due */
  left: number
  lines: AccountLine[]
}

/**
 * One account per project. A payment is either a ledger payment or an approved expense entry recorded under the
 * contractor's name (that is how payments were made before dues were tracked). The remaining amount only means
 * something where a due exists, so a project without one just lists what was paid.
 */
export function buildAccounts(txns: LedgerTxn[], spent: Spent[]): ProjectAccount[] {
  const groups = new Map<string, { name: string; lines: Omit<AccountLine, 'run'>[] }>()
  const group = (key: string, name: string) => {
    const g = groups.get(key) ?? { name, lines: [] }
    groups.set(key, g)
    return g
  }
  for (const t of txns) {
    group(t.project_id ?? 'none', t.project?.name ?? 'من غير مشروع').lines.push({
      key: t.id,
      kind: t.kind,
      date: t.txn_date,
      amount: t.amount,
      txn: t,
    })
  }
  for (const e of spent) {
    group(e.project_id, e.project?.name ?? 'من غير مشروع').lines.push({
      key: `e-${e.id}`,
      kind: 'payment',
      date: e.entry_date,
      amount: e.amount,
      entry: e,
    })
  }
  return [...groups.entries()]
    .map(([key, g]) => {
      const lines = g.lines.slice().sort((a, b) => a.date.localeCompare(b.date) || (a.txn ? -1 : 1))
      const sum = (kind: 'due' | 'payment') =>
        lines.filter((l) => l.kind === kind).reduce((s, l) => s + toCents(l.amount), 0) / 100
      const due = sum('due')
      const paid = sum('payment')
      const hasDue = lines.some((l) => l.kind === 'due')
      let run = 0
      return {
        key,
        name: g.name,
        due,
        paid,
        hasDue,
        left: hasDue ? (toCents(due) - toCents(paid)) / 100 : 0,
        lines: lines.map((l) => {
          run += toCents(l.kind === 'due' ? l.amount : -l.amount)
          return { ...l, run: hasDue ? run / 100 : null }
        }),
      }
    })
    .sort((x, y) => (x.key === 'none' ? 1 : y.key === 'none' ? -1 : x.name.localeCompare(y.name, 'ar')))
}
