import SearchSelect from './SearchSelect'
import { FILTER_LABEL, type FilterKey, type ReportFilter } from '../lib/reportFilter'

type Props = {
  keys: readonly FilterKey[]
  value: ReportFilter
  options: Record<FilterKey, readonly string[]>
  onChange: (next: ReportFilter) => void
}

/** The optional "narrow it down" choices of a report: type to search, pick from what exists, clear to see all. */
export default function ReportFilters({ keys, value, options, onChange }: Props) {
  if (keys.length === 0) return null
  return (
    <fieldset className="cols">
      <legend>فلترة (اختياري)</legend>
      {keys.map((k) => (
        <SearchSelect
          key={k}
          label={FILTER_LABEL[k]}
          value={value[k]}
          options={options[k]}
          placeholder="الكل"
          onChange={(v) => onChange({ ...value, [k]: v })}
        />
      ))}
    </fieldset>
  )
}
