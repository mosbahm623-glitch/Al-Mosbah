import SearchSelect from '../../components/SearchSelect'
import type { Named } from '../../lib/core/lookups'

/** A searchable list of names that hands back the id of the chosen one (the report pickers all work this way). */
export const pickerSelect = (
  label: string,
  value: string,
  set: (v: string) => void,
  options: Named[] | undefined,
  loading: boolean,
  emptyText: string,
  all?: string,
) => (
  <SearchSelect
    label={label}
    value={options?.find((o) => o.id === value)?.name ?? ''}
    options={(options ?? []).map((o) => o.name)}
    placeholder={all ?? (options?.length ? 'اختار...' : loading ? 'جارٍ التحميل...' : emptyText)}
    disabled={!options?.length}
    onChange={(name) => set(options?.find((o) => o.name === name)?.id ?? '')}
  />
)
