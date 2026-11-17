import { hasColumns, type ReportType } from './reportTypes'

type AdvanceParts = { given: boolean; spent: boolean; returned: boolean }

type Props = {
  type: ReportType
  parts: AdvanceParts
  setParts: (p: AdvanceParts) => void
  partsOk: boolean
  withContractor: boolean
  setWithContractor: (v: boolean) => void
  withBank: boolean
  setWithBank: (v: boolean) => void
  withEnteredBy: boolean
  setWithEnteredBy: (v: boolean) => void
  withNotes: boolean
  setWithNotes: (v: boolean) => void
}

/** The tick boxes under the report picker: which parts of a custody statement and which columns to show. */
export default function ReportOptions({
  type,
  parts,
  setParts,
  partsOk,
  withContractor,
  setWithContractor,
  withBank,
  setWithBank,
  withEnteredBy,
  setWithEnteredBy,
  withNotes,
  setWithNotes,
}: Props) {
  return (
    <>
      {type === 'advance' && (
        <fieldset className="cols">
          <legend>اعرض في الكشف</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={parts.given}
              onChange={(e) => setParts({ ...parts, given: e.target.checked })}
            />
            الوارد (الدفعات المستلمة)
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={parts.spent}
              onChange={(e) => setParts({ ...parts, spent: e.target.checked })}
            />
            المصروفات
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={parts.returned}
              onChange={(e) => setParts({ ...parts, returned: e.target.checked })}
            />
            المرتجع
          </label>
          {!partsOk && <p className="msg msg-error">اختار قسم واحد على الأقل.</p>}
        </fieldset>
      )}

      {hasColumns(type) && (
        <fieldset className="cols cols-inline">
          <legend>أعمدة التقرير</legend>
          <label className="check">
            <input type="checkbox" checked={withContractor} onChange={(e) => setWithContractor(e.target.checked)} />
            المقاول
          </label>
          {type !== 'advance' && (
            <label className="check">
              <input type="checkbox" checked={withBank} onChange={(e) => setWithBank(e.target.checked)} />
              البنك
            </label>
          )}
          <label className="check">
            <input type="checkbox" checked={withEnteredBy} onChange={(e) => setWithEnteredBy(e.target.checked)} />
            المدخل
          </label>
          <label className="check">
            <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />
            الملاحظات
          </label>
        </fieldset>
      )}
    </>
  )
}
