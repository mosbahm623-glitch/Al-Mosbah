import type { ProjectSummary } from '../lib/projects/projects'
import SearchSelect from './SearchSelect'

/** The project an entry belongs to (an entry being edited can be moved to another project). */
export function EntryProjectField({
  projects,
  value,
  onChange,
  required,
}: {
  projects: ProjectSummary[]
  value: string
  onChange: (id: string) => void
  /** new entries must choose one; an existing entry already has it */
  required: boolean
}) {
  const chosen = projects.find((p) => p.id === value)
  return (
    <div className="span-2">
      <SearchSelect
        label="المشروع"
        value={chosen?.name ?? ''}
        options={projects.map((p) => p.name)}
        placeholder={required ? 'اختار المشروع (اكتب للبحث)' : 'ابحث عن مشروع'}
        onChange={(name) => {
          const hit = projects.find((p) => p.name === name)
          if (hit) onChange(hit.id)
          else if (!name && required) onChange('')
        }}
      />
    </div>
  )
}

/** Amount, date and notes: the same three inputs for every kind of entry. */
export function EntryAmountFields({
  amount,
  onAmount,
  date,
  onDate,
  notes,
  onNotes,
}: {
  amount: string
  onAmount: (v: string) => void
  date: string
  onDate: (v: string) => void
  notes: string
  onNotes: (v: string) => void
}) {
  return (
    <>
      <div className="field-row">
        <label className="field">
          المبلغ (ج.م)
          <input value={amount} onChange={(e) => onAmount(e.target.value)} inputMode="decimal" required />
        </label>
        <label className="field">
          التاريخ
          <input type="date" value={date} onChange={(e) => onDate(e.target.value)} required />
        </label>
      </div>
      <label className="field">
        ملاحظات
        <input value={notes} onChange={(e) => onNotes(e.target.value)} />
      </label>
    </>
  )
}

/** A required one-line reason (why an entry was edited or deleted). */
export function ReasonField({
  label,
  value,
  onChange,
  placeholder,
  className = '',
  autoFocus,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <label className={`field span-2 ${className}`.trim()}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        required
      />
    </label>
  )
}

/** What an income entry is for (e.g. a client payment): income has no category list like expenses do. */
export function IncomeLabelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="field span-2">
      بيان الوارد
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="مثلاً: دفعة عميل" required />
    </label>
  )
}
