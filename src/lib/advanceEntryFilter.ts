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
