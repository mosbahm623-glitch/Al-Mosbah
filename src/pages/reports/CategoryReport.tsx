import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import { TYPE_LABEL, money, periodText, todayISO, type ProjectType } from '../../lib/format'
import { fetchApprovedExpenses, type ExpenseRow as Row } from '../../lib/entries'
import { categoryTotals } from '../../lib/reportBuilders'
import { useAsync } from '../../lib/useAsync'
import { sumMoney } from '../../lib/money'
import { filterMeta, matches, type ReportFilter } from '../../lib/reportFilter'

/** Where the money went: expenses per بند across all projects (including what was paid from custodies). */
export default function CategoryReport({
  from,
  to,
  type,
  filter,
}: {
  from: string
  to: string
  type: 'all' | ProjectType
  filter: ReportFilter
}) {
  const load = useCallback(async () => {
    const rows = await fetchApprovedExpenses(from, to)
    return { data: rows, error: rows === null }
  }, [from, to])
  const { data, failed } = useAsync<Row[]>(load)

  const rows = useMemo(
    () =>
      categoryTotals(
        (data ?? []).filter(
          (r) =>
            (type === 'all' || r.project?.type === type) &&
            matches(filter, {
              project: r.project?.name,
              contractor: r.contractor?.name,
              bank: r.bank?.name,
            }),
        ),
      ),
    [data, type, filter],
  )

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  const total = sumMoney(rows.map((r) => r.total))
  const count = rows.reduce((s, r) => s + r.count, 0)

  return (
    <TableReport
      title="المصروفات حسب البند"
      filename={`المصباح - مصروفات حسب البند - ${todayISO()}.xlsx`}
      meta={[
        { label: 'الفترة', value: periodText(from, to) },
        { label: 'نوع المشاريع', value: type === 'all' ? 'كل الأنواع' : TYPE_LABEL[type] },
        ...filterMeta(filter),
      ]}
      kpis={[
        { label: 'إجمالي المصروفات', value: money(total), tone: 'err' },
        { label: 'عدد البنود', value: String(rows.length), tone: 'neutral' },
        { label: 'أعلى بند', value: rows[0]?.category ?? '—', tone: 'warn' },
      ]}
      sections={[
        {
          cols: [{ h: 'البند' }, { h: 'عدد القيود', kind: 'int' }, { h: 'الإجمالي', kind: 'money' }, { h: 'النسبة' }],
          rows: rows.map((r) => [r.category, r.count, r.total, `${r.share}%`]),
          footer: ['الإجمالي', count, total, rows.length ? '100%' : null],
          empty: 'مفيش مصروفات في الفترة دي.',
        },
      ]}
      note="شامل المصروفات المدفوعة من عهد، لأن المقصود إن الفلوس راحت فين."
    />
  )
}
