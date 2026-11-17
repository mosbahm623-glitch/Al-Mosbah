import SearchSelect from './SearchSelect'
import type { Category } from '../lib/catalog'

type Props = {
  category: Category | undefined
  categoryName: string
  categoryOptions: string[]
  onCategory: (name: string) => void
  onCreateCategory: (name: string) => Promise<string | null>
  contractorName: string
  contractorOptions: string[]
  noContractor: boolean
  onContractor: (name: string) => void
  onNoContractor: (value: boolean) => void
  itemName: string
  onItem: (name: string) => void
  /** a new entry from a custody or an owner: the contractor is picked, or «بدون مقاول» is ticked */
  strict: boolean
}

/** The three fields an expense (and a refund) has and an income doesn't: البند, اسم المقاول, البيان. */
export default function EntryExpenseFields(p: Props) {
  return (
    <>
      <SearchSelect
        label="البند"
        value={p.categoryName}
        options={p.categoryOptions}
        placeholder="دوّر أو اختار البند"
        onChange={p.onCategory}
        onCreate={p.onCreateCategory}
      />
      <SearchSelect
        label="اسم المقاول"
        value={p.noContractor ? '' : p.contractorName}
        options={p.contractorOptions}
        placeholder={p.strict ? 'دوّر أو اختار المقاول' : 'دوّر أو اكتب اسم المقاول (اختياري)'}
        freeText
        disabled={p.noContractor}
        onChange={p.onContractor}
        labelExtra={
          p.strict && (
            <label className="check">
              <input
                type="checkbox"
                checked={p.noContractor}
                onChange={(e) => {
                  p.onNoContractor(e.target.checked)
                  if (e.target.checked) p.onContractor('')
                }}
              />
              بدون مقاول
            </label>
          )
        }
      />
      <div className="span-2">
        <SearchSelect
          label="البيان"
          value={p.itemName}
          options={p.category?.expense_items.map((i) => i.name) ?? []}
          placeholder={p.categoryName ? 'اكتب البيان' : 'اختار البند الأول'}
          disabled={!p.categoryName}
          freeText
          multiline
          onChange={p.onItem}
        />
      </div>
    </>
  )
}
