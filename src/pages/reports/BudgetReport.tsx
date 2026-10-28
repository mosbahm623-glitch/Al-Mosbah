import { useMemo } from 'react'
import TableReport from '../../components/TableReport'
import { TYPE_LABEL, money, todayISO } from '../../lib/format'
import { fetchSummaries, type ProjectSummary } from '../../lib/projects'
import { NEAR_LIMIT, budgetRows, type BudgetMode } from '../../lib/reportBuilders'
import { useAsync } from '../../lib/useAsync'
import { toCents } from '../../lib/money'

const TITLE: Record<BudgetMode, string> = { all: 'متابعة الميزانيات', near: 'مشاريع قربت من الميزانية', over: 'مشاريع تجاوزت الميزانية' }

/** Budget against spending per project, most used first. */
export default function BudgetReport({ mode }: { mode: BudgetMode }) {
  const { data, failed } = useAsync<ProjectSummary[]>(fetchSummaries)
  const rows = useMemo(() => budgetRows(data ?? [], mode), [data, mode])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  const budget = rows.reduce((s, r) => s + toCents(r.p.budget), 0) / 100
  const spent = rows.reduce((s, r) => s + toCents(r.p.expenses), 0) / 100
  const over = rows.filter((r) => r.over).length

  return (
    <TableReport
      title={TITLE[mode]}
      filename={`المصباح - ${TITLE[mode]} - ${todayISO()}.xlsx`}
      kpis={[
        { label: 'عدد المشاريع', value: String(rows.length), tone: 'neutral' },
        { label: 'إجمالي الميزانيات', value: money(budget), tone: 'blue' },
        { label: 'إجمالي المصروف', value: money(spent), tone: 'err' },
        { label: 'تجاوزت الميزانية', value: String(over), tone: 'warn', neg: over > 0 },
      ]}
      sections={[
        {
          cols: [
            { h: 'المشروع' },
            { h: 'النوع' },
            { h: 'الحالة' },
            { h: 'الميزانية', kind: 'money' },
            { h: 'المصروف', kind: 'money' },
            { h: 'المتبقي', kind: 'money' },
            { h: 'الاستهلاك' },
          ],
          rows: rows.map((r) => [
            r.p.name,
            TYPE_LABEL[r.p.type],
            r.p.status === 'active' ? 'نشط' : 'مقفول',
            r.p.budget,
            r.p.expenses,
            r.remaining,
            `${r.percent}%`,
          ]),
          footer: ['الإجمالي', null, null, budget, spent, (toCents(budget) - toCents(spent)) / 100, budget > 0 ? `${Math.round((spent / budget) * 100)}%` : null],
          empty: mode === 'all' ? 'مفيش مشاريع ليها ميزانية.' : 'مفيش مشاريع بالحالة دي.',
        },
      ]}
      note={`المشاريع اللي من غير ميزانية مش بتظهر هنا. "قربت" معناها استهلكت ${NEAR_LIMIT}% أو أكتر ولسه ماتجاوزتش. المصروف شامل دفعات العهد.`}
    />
  )
}
