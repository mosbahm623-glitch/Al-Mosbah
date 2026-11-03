import { NO_FILTER, isFiltering, type ApprovalFilter } from '../../lib/approvals'

type Props = {
  filter: ApprovalFilter
  onChange: (next: ApprovalFilter) => void
  /** who recorded the entries on screen, and the banks they used: the choices of the two lists */
  names: string[]
  banks: string[]
}

/** The search fields above the approvals list. An empty field does not filter. */
export default function ApprovalFilters({ filter, onChange, names, banks }: Props) {
  const setF = (patch: Partial<ApprovalFilter>) => onChange({ ...filter, ...patch })
  return (
    <section className="card appr-filters" aria-label="فلتر القيود">
      <label className="field">
        كلمة في البيان
        <input value={filter.text} onChange={(e) => setF({ text: e.target.value })} placeholder="مثلًا: نقاشة" />
      </label>
      <label className="field">
        سجّله
        <select value={filter.who} onChange={(e) => setF({ who: e.target.value })}>
          <option value="">الكل</option>
          {names.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        البنك
        <select value={filter.bank} onChange={(e) => setF({ bank: e.target.value })}>
          <option value="">الكل</option>
          {banks.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        يوم القيد
        <input type="date" value={filter.day} onChange={(e) => setF({ day: e.target.value })} />
      </label>
      <label className="field">
        المبلغ من
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={filter.min}
          onChange={(e) => setF({ min: e.target.value })}
        />
      </label>
      <label className="field">
        المبلغ إلى
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={filter.max}
          onChange={(e) => setF({ max: e.target.value })}
        />
      </label>
      {isFiltering(filter) && (
        <button type="button" className="btn btn-ghost appr-filters-clear" onClick={() => onChange(NO_FILTER)}>
          مسح الفلتر
        </button>
      )}
    </section>
  )
}
