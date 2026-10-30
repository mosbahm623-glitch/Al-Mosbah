import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell, Col } from '../../lib/tableTypes'
import { money, periodText, todayISO } from '../../lib/format'
import { KIND_LABEL, fetchMovements, totalsOfDay, type Movement } from '../../lib/movements'
import { useAsync } from '../../lib/useAsync'
import type { ReportColumns } from '../../lib/reportColumns'

type Props = { from: string; to: string; projectId: string; projectName: string } & ReportColumns

/** Every approved movement between two dates, for one project or all of them. */
export default function PeriodReport({
  from,
  to,
  projectId,
  projectName,
  withContractor,
  withBank: bankWanted,
  withNotes,
}: Props) {
  const fetchRows = useCallback(async () => {
    const rows = await fetchMovements({
      from: from || '2000-01-01',
      to: to || todayISO(),
      project: projectId || undefined,
    })
    return { data: rows, error: rows === null }
  }, [from, to, projectId])
  const { data, failed } = useAsync<Movement[]>(fetchRows)

  const rows = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => a.date.localeCompare(b.date) || a.at.localeCompare(b.at) || (a.seq ?? 0) - (b.seq ?? 0),
      ),
    [data],
  )
  const t = useMemo(() => totalsOfDay(rows), [rows])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  const withBank = bankWanted && rows.some((m) => m.detail)
  const cols: Col[] = [
    { h: 'التاريخ', kind: 'date' },
    { h: 'رقم', kind: 'int' },
    { h: 'النوع' },
    { h: 'البند' },
    { h: 'البيان' },
    { h: 'المشروع' },
    ...(withContractor ? [{ h: 'المقاول / العهدة' }] : []),
    ...(withBank ? [{ h: 'البنك' }] : []),
    ...(withNotes ? [{ h: 'ملاحظات' }] : []),
    { h: 'المبلغ', kind: 'money' as const },
  ]
  const body: Cell[][] = rows.map((m) => [
    m.date,
    m.seq,
    KIND_LABEL[m.kind] + (m.fromAdvance ? ' (من عهدة)' : ''),
    m.category,
    m.title,
    m.project,
    ...(withContractor ? [m.party] : []),
    ...(withBank ? [m.detail] : []),
    ...(withNotes ? [m.notes] : []),
    m.amount,
  ])

  return (
    <TableReport
      title="تقرير فترة"
      filename={`المصباح - تقرير فترة - ${from || 'البداية'} إلى ${to || todayISO()}.xlsx`}
      meta={[
        { label: 'الفترة', value: periodText(from, to) },
        { label: 'المشروع', value: projectId ? projectName : 'كل المشاريع' },
      ]}
      kpis={[
        { label: 'إجمالي الوارد', value: money(t.income), tone: 'ok' },
        { label: 'إجمالي المصروف', value: money(t.expense), tone: 'err' },
        { label: 'مدفوعات مقاولين', value: money(t.payment), tone: 'blue' },
        ...(projectId ? [] : [{ label: 'دفعات عهد', value: money(t.installment), tone: 'warn' as const }]),
        { label: 'عدد الحركات', value: String(t.count), tone: 'neutral' },
      ]}
      sections={[
        {
          cols,
          rows: body,
          footer: [`عدد الحركات: ${t.count}`, ...cols.slice(1).map(() => null)],
          empty: 'مفيش حركات في الفترة دي.',
        },
      ]}
      note={
        projectId
          ? 'تقرير مشروع واحد: دفعات ومرتجع العهد مش بتظهر لأنها مش مربوطة بمشروع.'
          : t.expense !== t.cashExpense
            ? `من المصروف ${money(t.expense - t.cashExpense)} اتدفع من عهد، فمتحسبش تاني مع دفعات العهد.`
            : undefined
      }
    />
  )
}
