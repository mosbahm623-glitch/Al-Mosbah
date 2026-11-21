import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell, Section } from '../../lib/core/tableTypes'
import { money, monthLabel, periodText, todayISO } from '../../lib/core/format'
import { fetchContractorLedger, type LedgerTxn as Txn, type Spent } from '../../lib/contractors/contractors'
import { inRange, monthTotals, projectGroups, runLedger } from '../../lib/reports/reportBuilders'
import { useAsync } from '../../lib/core/useAsync'
import { toCents } from '../../lib/core/money'
import { filterMeta, matches, type ReportFilter } from '../../lib/reports/reportFilter'

/**
 * Everything recorded under one contractor's name (the total, by month, and by project with a subtotal each),
 * then the dues and payments ledger with its running balance. Closed projects are left out unless asked for.
 */
export default function ContractorStatement({
  id,
  name,
  from,
  to,
  filter,
  includeClosed,
}: {
  id: string
  name: string
  from: string
  to: string
  filter: ReportFilter
  includeClosed: boolean
}) {
  const load = useCallback(async () => {
    const ledger = await fetchContractorLedger(id)
    return { data: ledger, error: ledger === null }
  }, [id])
  const { data, failed } = useAsync<{ txns: Txn[]; spent: Spent[] }>(load)

  const view = useMemo(() => {
    if (!data) return null
    const ledger = runLedger(
      0,
      data.txns
        .filter((t) => matches(filter, { project: t.project?.name }))
        .map((t) => ({ ...t, date: t.txn_date, delta: t.kind === 'due' ? t.amount : -t.amount })),
      from,
      to,
    )
    const dues = ledger.rows.filter((r) => r.kind === 'due').reduce((s, r) => s + toCents(r.amount), 0) / 100
    const paid = ledger.rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + toCents(r.amount), 0) / 100
    const spent = data.spent.filter(
      (e) =>
        inRange(e.entry_date, from, to) &&
        (includeClosed || e.project?.status !== 'closed') &&
        matches(filter, { project: e.project?.name, category: e.category }),
    )
    return {
      ledger,
      dues,
      paid,
      spent,
      spentTotal: spent.reduce((s, e) => s + toCents(e.amount), 0) / 100,
      months: monthTotals(spent),
      groups: projectGroups(spent),
    }
  }, [data, from, to, filter, includeClosed])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الكشف، جرّب تاني</p>
  if (!view) return <p className="muted">جارٍ التحميل...</p>
  const { ledger, dues, paid, spent, spentTotal, months, groups } = view

  const ledgerRows: Cell[][] = [
    ...(from ? [[from, 'رصيد قبل الفترة', null, null, null, null, ledger.opening] as Cell[]] : []),
    ...ledger.rows.map((r): Cell[] => [
      r.txn_date,
      r.kind === 'due' ? 'مستحق' : 'دفعة',
      r.project?.name ?? null,
      r.notes,
      r.kind === 'due' ? r.amount : null,
      r.kind === 'payment' ? r.amount : null,
      r.run,
    ]),
  ]

  return (
    <TableReport
      title={`كشف حساب مقاول: ${name}`}
      filename={`Legacy ERP - كشف مقاول ${name} - ${todayISO()}.xlsx`}
      meta={[
        { label: 'المقاول', value: name },
        { label: 'الفترة', value: periodText(from, to) },
        { label: 'المشاريع المقفولة', value: includeClosed ? 'مضمّنة' : 'مستبعدة' },
        // the بند narrows the recorded expenses only: the dues and payments below have no بند, so say so
        ...filterMeta(filter).map((f) => (f.label === 'البند' ? { ...f, label: 'البند (على المصروفات بس)' } : f)),
      ]}
      kpis={[
        { label: 'إجمالي المصروفات المسجلة باسمه', value: money(spentTotal), tone: 'err' },
        { label: 'عدد القيود', value: String(spent.length), tone: 'blue' },
      ]}
      sections={[
        {
          heading: 'التوزيع الشهري',
          cols: [{ h: 'الشهر' }, { h: 'عدد القيود', kind: 'int' }, { h: 'المبلغ', kind: 'money' }],
          rows: months.map((m): Cell[] => [monthLabel(m.month), m.count, m.total]),
          footer: ['الإجمالي', spent.length, spentTotal],
          empty: 'مفيش قيود مسجلة باسمه في الفترة دي.',
        },
        ...groups.map((g): Section => ({
          heading: `تفاصيل المصروفات: ${g.name}`,
          cols: [
            { h: 'رقم', kind: 'int' },
            { h: 'التاريخ', kind: 'date' },
            { h: 'البند' },
            { h: 'البيان' },
            { h: 'المبلغ', kind: 'money' },
          ],
          rows: g.rows.map((e): Cell[] => [e.seq, e.entry_date, e.category, e.item, e.amount]),
          footer: [`إجمالي ${g.name}`, null, null, null, g.total],
        })),
        {
          heading: filter.category ? 'المستحقات والمدفوعات (مش متأثرة بفلتر البند)' : 'المستحقات والمدفوعات',
          cols: [
            { h: 'التاريخ', kind: 'date' },
            { h: 'النوع' },
            { h: 'المشروع' },
            { h: 'ملاحظات' },
            { h: 'مستحق', kind: 'money' },
            { h: 'مدفوع', kind: 'money' },
            { h: 'الرصيد', kind: 'money' },
          ],
          rows: ledgerRows,
          footer: ['الإجمالي', null, null, null, dues, paid, ledger.closing],
          empty: 'مفيش مستحقات أو مدفوعات في الفترة دي.',
        },
      ]}
      note="إجمالي المصروفات المسجلة باسمه = كل المصروفات المسجلة باسم المقاول. الرصيد في جدول المستحقات = المستحق − المدفوع، والرصيد الموجب معناه إن للمقاول فلوس عندنا، وهو منفصل عن إجمالي المدفوعات."
    />
  )
}
