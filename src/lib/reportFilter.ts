/** Optional filters shared by the reports. An empty value means "all". Names, because every report row carries names. */
export type FilterKey = 'project' | 'contractor' | 'bank' | 'category'
export type ReportFilter = Record<FilterKey, string>

export const NO_FILTER: ReportFilter = { project: '', contractor: '', bank: '', category: '' }

export const FILTER_LABEL: Record<FilterKey, string> = {
  project: 'المشروع',
  contractor: 'المقاول',
  bank: 'البنك',
  category: 'البند',
}

/** The part of a filter a report actually uses (the others are cleared, so they never hide rows by mistake). */
export const only = (f: ReportFilter, keys: readonly FilterKey[]): ReportFilter => ({
  project: keys.includes('project') ? f.project : '',
  contractor: keys.includes('contractor') ? f.contractor : '',
  bank: keys.includes('bank') ? f.bank : '',
  category: keys.includes('category') ? f.category : '',
})

export const isFiltering = (f: ReportFilter) => Object.values(f).some(Boolean)

type Row = { project?: string | null; contractor?: string | null; bank?: string | null; category?: string | null }

/** True when the row passes every filter that is set. */
export const matches = (f: ReportFilter, r: Row) =>
  (Object.keys(FILTER_LABEL) as FilterKey[]).every((k) => !f[k] || !(k in r) || r[k] === f[k])

/** For a report's header: one entry per filter that is set. */
export const filterMeta = (f: ReportFilter) =>
  (Object.keys(FILTER_LABEL) as FilterKey[]).filter((k) => f[k]).map((k) => ({ label: FILTER_LABEL[k], value: f[k] }))
