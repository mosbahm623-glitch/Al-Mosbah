import SearchSelect from '../../components/SearchSelect'
import InvoiceField from '../../components/InvoiceField'
import {
  DRAFT_TYPES,
  missingOf,
  needsBank,
  needsCategory,
  needsCustody,
  needsProject,
  needsProof,
  type Draft,
  type DraftType,
} from '../../lib/voice/drafts'
import type { VoiceData } from '../../lib/voice/data'

type Props = {
  draft: Draft
  /** null in trial mode: the names are invented, shown for reading only */
  data: VoiceData | null
  busy: boolean
  error?: string
  duplicate: boolean
  onChange: (patch: Partial<Draft>) => void
  onSave: () => void
  onRemove: () => void
}

const names = (list: { name: string }[]) => list.map((x) => x.name)

/** One heard entry, to be checked, completed and saved. */
export default function DraftCard({ draft: d, data, busy, error, duplicate, onChange, onSave, onRemove }: Props) {
  const missing = data ? missingOf(d, data.owner) : []
  const proof = needsProof(d.type, Boolean(data?.owner))
  const mark = (label: string, field: string) => (d.suggested.includes(field) ? `${label} (اقتراح)` : label)
  const picker = (label: string, field: 'project' | 'category' | 'contractor' | 'bank' | 'custody', list: string[]) => (
    <SearchSelect
      label={mark(label, field)}
      value={d[field]}
      options={list}
      placeholder="دوّر أو اختار"
      disabled={!data || (field === 'contractor' && d.noContractor)}
      onChange={(v) => onChange({ [field]: v, suggested: d.suggested.filter((s) => s !== field) })}
    />
  )
  const category = data?.categories.find((c) => c.name === d.category)

  return (
    <section className="panel quick-form" aria-label={`${DRAFT_TYPES[d.type]} ${d.amount}`}>
      <fieldset className="dialog-form voice-card" disabled={busy}>
        <label className="field span-2">
          النوع
          <select value={d.type} onChange={(e) => onChange({ type: e.target.value as DraftType })} disabled={!data}>
            {Object.entries(DRAFT_TYPES).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {needsCustody(d.type) && picker('العهدة', 'custody', names(data?.custodies ?? []))}
        {needsProject(d.type) && picker('المشروع', 'project', names(data?.projects ?? []))}
        {needsCategory(d.type) && picker('البند', 'category', names(data?.categories ?? []))}
        {needsCategory(d.type) && picker('اسم المقاول', 'contractor', names(data?.contractors ?? []))}
        {proof && needsCategory(d.type) && (
          <label className="check">
            <input
              type="checkbox"
              checked={d.noContractor}
              onChange={(e) => onChange({ noContractor: e.target.checked, contractor: '' })}
              disabled={!data}
            />
            بدون مقاول
          </label>
        )}
        {d.type !== 'custody_payment' && (
          <div className="span-2">
            <SearchSelect
              label="البيان"
              value={d.item}
              options={category?.expense_items.map((i) => i.name) ?? []}
              placeholder="اكتب البيان"
              disabled={!data}
              freeText
              multiline
              onChange={(item) => onChange({ item })}
            />
          </div>
        )}
        {needsBank(d.type) && picker('البنك / الحساب', 'bank', names(data?.banks ?? []))}
        <label className="field">
          المبلغ (ج.م)
          <input
            value={d.amount}
            onChange={(e) => onChange({ amount: e.target.value })}
            inputMode="decimal"
            disabled={!data}
          />
        </label>
        <label className="field">
          التاريخ
          <input type="date" value={d.date} onChange={(e) => onChange({ date: e.target.value })} disabled={!data} />
        </label>
        {d.type !== 'custody_payment' && (
          <label className="field span-2">
            ملاحظات
            <input value={d.notes} onChange={(e) => onChange({ notes: e.target.value })} disabled={!data} />
          </label>
        )}
        {data && d.type !== 'custody_payment' && (
          <InvoiceField
            files={d.files}
            onFiles={(files) => onChange({ files })}
            canRemove
            required={proof && !d.noInvoice}
            noInvoice={proof ? d.noInvoice : undefined}
            onNoInvoice={
              proof ? (noInvoice) => onChange(noInvoice ? { noInvoice, files: [] } : { noInvoice }) : undefined
            }
          />
        )}
        {d.question && <p className="msg span-2">{d.question}</p>}
        {duplicate && <p className="msg msg-error span-2">خلي بالك: فيه قيد بنفس المبلغ والتاريخ متسجل قبل كده.</p>}
        {missing.length > 0 && <p className="msg span-2 muted">ناقص: {missing.join('، ')}</p>}
        {error && <p className="msg msg-error span-2">{error}</p>}
        <div className="dialog-actions span-2">
          {data && (
            <button type="button" className="btn" onClick={onSave} disabled={busy || missing.length > 0}>
              {duplicate ? 'حفظ رغم التشابه' : 'حفظ القيد'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onRemove}>
            شيل
          </button>
        </div>
      </fieldset>
    </section>
  )
}
