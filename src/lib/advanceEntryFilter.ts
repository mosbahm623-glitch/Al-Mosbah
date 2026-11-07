import type { AdvanceReturn, Installment } from './advances'
import type { Entry } from './projects'

/** The search fields above a custody's expenses. An empty field does not filter. */
export type AdvanceEntryFilter = {
  text: string
  project: string
  category: string
  contractor: string
  who: string
  from: string
  to: string
}

export const NO_ENTRY_FILTER: AdvanceEntryFilter = {
  text: '',
  project: '',
  category: '',
  contractor: '',
  who: '',
  from: '',
  to: '',
}

export const isEntryFiltering = (f: AdvanceEntryFilter) => Object.values(f).some((v) => v !== '')

/** المدخل: the profile that recorded it, else the name copied from the old system. */
export const enteredByOf = (e: Entry) => e.creator?.full_name ?? e.entered_by_name ?? null

export function filterAdvanceEntries(rows: Entry[], f: AdvanceEntryFilter): Entry[] {
  const text = f.text.trim().toLowerCase()
  return rows.filter((e) => {
    if (text && !`${e.item ?? ''} ${e.notes ?? ''}`.toLowerCase().includes(text)) return false
    if (f.project && (e.project?.name ?? '') !== f.project) return false
    if (f.category && e.category !== f.category) return false
    if (f.contractor && (e.contractor?.name ?? '') !== f.contractor) return false
    if (f.who && (enteredByOf(e) ?? '') !== f.who) return false
    if (f.from && e.entry_date < f.from) return false
    if (f.to && e.entry_date > f.to) return false
    return true
  })
}

/** The distinct, sorted values a select offers. */
export function choicesOf(rows: Entry[], pick: (e: Entry) => string | null | undefined): string[] {
  return [...new Set(rows.map(pick).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b, 'ar'))
}

export type MoveType = 'in' | 'out' | 'back'
export type MoveFilter = 'all' | MoveType

/** One line of a custody's movement: a payment received, an expense, or money given back. */
export type Move =
  | { key: string; type: 'in'; date: string; amount: number; row: Installment }
  | { key: string; type: 'out'; date: string; amount: number; row: Entry }
  | { key: string; type: 'back'; date: string; amount: number; row: AdvanceReturn }

export const MOVE_LABEL: Record<MoveType, string> = { in: 'وارد', out: 'مصروف', back: 'مرتجع' }

/** Newest first; expenses of the same day by their number. */
export function buildMoves(installments: Installment[], entries: Entry[], returns: AdvanceReturn[]): Move[] {
  const moves: Move[] = [
    ...installments.map((r): Move => ({ key: `i-${r.id}`, type: 'in', date: r.paid_on, amount: r.amount, row: r })),
    ...entries.map((r): Move => ({ key: `e-${r.id}`, type: 'out', date: r.entry_date, amount: r.amount, row: r })),
    ...returns.map((r): Move => ({ key: `r-${r.id}`, type: 'back', date: r.returned_on, amount: r.amount, row: r })),
  ]
  const seqOf = (m: Move) => (m.type === 'out' ? m.row.seq : 0)
  return moves.sort((a, b) => b.date.localeCompare(a.date) || seqOf(b) - seqOf(a))
}

const ENTRY_ONLY = ['project', 'category', 'contractor', 'who'] as const

/** The date range and the word apply to every kind; the project, category, contractor and entrant only to expenses. */
export function filterMoves(moves: Move[], kind: MoveFilter, f: AdvanceEntryFilter): Move[] {
  const entryFilterOn = ENTRY_ONLY.some((k) => f[k] !== '')
  const text = f.text.trim().toLowerCase()
  return moves.filter((m) => {
    if (kind !== 'all' && m.type !== kind) return false
    if (f.from && m.date < f.from) return false
    if (f.to && m.date > f.to) return false
    if (m.type !== 'out') {
      if (entryFilterOn) return false
      if (m.type === 'back' && text && !(m.row.notes ?? '').toLowerCase().includes(text)) return false
      return !(m.type === 'in' && text)
    }
    return filterAdvanceEntries([m.row], { ...f, from: '', to: '' }).length === 1
  })
}

/** What the shown lines add up to: only approved payments and expenses count, like the custody's own totals. */
export function totalsOfMoves(moves: Move[]) {
  const t = { in: 0, out: 0, back: 0 }
  for (const m of moves) {
    if (m.type === 'back') t.back += m.amount
    else if (m.row.status === 'approved') t[m.type] += m.amount
  }
  return t
}
