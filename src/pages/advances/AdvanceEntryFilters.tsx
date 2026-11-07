import {
  NO_ENTRY_FILTER,
  choicesOf,
  enteredByOf,
  isEntryFiltering,
  type AdvanceEntryFilter,
} from '../../lib/advanceEntryFilter'
import type { Entry } from '../../lib/projects'

type Props = { rows: Entry[]; filter: AdvanceEntryFilter; onChange: (next: AdvanceEntryFilter) => void }

/** Search fields for one custody's expenses; the choices come from what that custody actually has. */
export default function AdvanceEntryFilters({ rows, filter, onChange }: Props) {
  const setF = (patch: Partial<AdvanceEntryFilter>) => onChange({ ...filter, ...patch })
  const lists: { key: 'project' | 'category' | 'contractor' | 'who'; label: string; options: string[] }[] = [
    { key: 'project', label: 'المشروع', options: choicesOf(rows, (e) => e.project?.name) },
    { key: 'category', label: 'البند', options: choicesOf(rows, (e) => e.category) },
    { key: 'contractor', label: 'المقاول', options: choicesOf(rows, (e) => e.contractor?.name) },
    { key: 'who', label: 'المدخل', options: choicesOf(rows, enteredByOf) },
  ]
  return (
    <section className="card appr-filters" aria-label="فلتر مصروفات العهدة">
      <label className="field">
        كلمة في البيان أو الملاحظات
        <input value={filter.text} onChange={(e) => setF({ text: e.target.value })} />
      </label>
      {lists.map(({ key, label, options }) => (
        <label className="field" key={key}>
          {label}
          <select value={filter[key]} onChange={(e) => setF({ [key]: e.target.value })}>
            <option value="">الكل</option>
            {options.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label className="field">
        من تاريخ
        <input type="date" value={filter.from} onChange={(e) => setF({ from: e.target.value })} />
      </label>
      <label className="field">
        إلى تاريخ
        <input type="date" value={filter.to} onChange={(e) => setF({ to: e.target.value })} />
      </label>
      {isEntryFiltering(filter) && (
        <button type="button" className="btn btn-ghost appr-filters-clear" onClick={() => onChange(NO_ENTRY_FILTER)}>
          مسح الفلتر
        </button>
      )}
    </section>
  )
}
