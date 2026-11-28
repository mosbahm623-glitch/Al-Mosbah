import { TYPE_LABEL, type ProjectType } from '../../lib/core/format'
import type { BudgetMode } from '../../lib/reports/reportBuilders'
import type { ReportType } from './reportTypes'

type Props = {
  type: ReportType
  kindFilter: 'all' | ProjectType
  setKindFilter: (v: 'all' | ProjectType) => void
  budgetMode: BudgetMode
  setBudgetMode: (v: BudgetMode) => void
}

/** The choices only the by-category and budget reports have. */
export default function ReportChoices({ type, kindFilter, setKindFilter, budgetMode, setBudgetMode }: Props) {
  return (
    <>
      {type === 'category' && (
        <label className="field">
          نوع المشاريع
          <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | ProjectType)}>
            <option value="all">كل الأنواع</option>
            <option value="finishing">{TYPE_LABEL.finishing}</option>
            <option value="furnishing">{TYPE_LABEL.furnishing}</option>
          </select>
        </label>
      )}
      {type === 'budget' && (
        <label className="field">
          المشاريع
          <select value={budgetMode} onChange={(e) => setBudgetMode(e.target.value as BudgetMode)}>
            <option value="all">كل المشاريع اللي ليها ميزانية</option>
            <option value="near">اللي قربت من الميزانية (80% أو أكتر)</option>
            <option value="over">اللي تجاوزت الميزانية</option>
          </select>
        </label>
      )}
    </>
  )
}
