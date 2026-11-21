import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell } from '../../lib/core/tableTypes'
import { fetchBankMovements, movementSign, type BankMovement } from '../../lib/banks/banks'
import { money, periodText, todayISO } from '../../lib/core/format'
import { runLedger } from '../../lib/reports/reportBuilders'
import { useAsync } from '../../lib/core/useAsync'
import { toCents } from '../../lib/core/money'
import { filterMeta, isFiltering, matches, type ReportFilter } from '../../lib/reports/reportFilter'

/** One bank account: balance before the period, every movement with its running balance, and the closing balance. */
export default function BankStatement({
  id,
  name,
  opening,
  from,
  to,
  filter,
}: {
  id: string
  name: string
  opening: number
  from: string
  to: string
  filter: ReportFilter
}) {
  const load = useCallback(() => fetchBankMovements(id), [id])
  const { data, failed } = useAsync<BankMovement[]>(load)

  const view = useMemo(() => {
    if (!data) return null
    const narrowed = isFiltering(filter)
    const ledger = runLedger(
      // the bank's opening balance belongs to the whole account, not to one project / contractor / بند
      narrowed ? 0 : opening,
      data
        .filter((m) => matches(filter, { project: m.project_name, contractor: m.contractor, category: m.category }))
        .map((m) => ({ ...m, date: m.entry_date, delta: movementSign(m) * m.amount })),
      from,
      to,
    )
    // a transfer into this bank counts as money in and a transfer out as money out, the same as on the bank's own page
    const sum = (sign: 1 | -1) =>
      ledger.rows.filter((r) => movementSign(r) === sign).reduce((s, r) => s + toCents(r.amount), 0) / 100
    return { ledger, income: sum(1), expense: sum(-1) }
  }, [data, opening, from, to, filter])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الكشف، جرّب تاني</p>
  if (!view) return <p className="muted">جارٍ التحميل...</p>
  const { ledger, income, expense } = view

  const rows: Cell[][] = [
    [from || null, null, null, null, 'رصيد قبل الفترة', null, null, null, ledger.opening],
    ...ledger.rows.map((m): Cell[] => [
      m.entry_date,
      m.seq,
      m.project_name,
      m.category,
      m.item,
      m.contractor,
      movementSign(m) > 0 ? m.amount : null,
      movementSign(m) < 0 ? m.amount : null,
      m.run,
    ]),
  ]

  return (
    <TableReport
      title={`كشف حساب بنك: ${name}`}
      filename={`Legacy ERP - كشف بنك ${name} - ${todayISO()}.xlsx`}
      meta={[{ label: 'البنك', value: name }, { label: 'الفترة', value: periodText(from, to) }, ...filterMeta(filter)]}
      kpis={[
        { label: 'الرصيد قبل الفترة', value: money(ledger.opening), tone: 'neutral' },
        { label: 'الوارد', value: money(income), tone: 'ok' },
        { label: 'المصروف', value: money(expense), tone: 'err' },
        { label: 'الرصيد الختامي', value: money(ledger.closing), tone: 'blue', neg: ledger.closing < 0 },
      ]}
      sections={[
        {
          cols: [
            { h: 'التاريخ', kind: 'date' },
            { h: 'رقم', kind: 'int' },
            { h: 'المشروع' },
            { h: 'البند' },
            { h: 'البيان' },
            { h: 'المقاول' },
            { h: 'وارد', kind: 'money' },
            { h: 'مصروف', kind: 'money' },
            { h: 'الرصيد', kind: 'money' },
          ],
          rows,
          footer: ['الإجمالي', null, null, null, null, null, income, expense, ledger.closing],
        },
      ]}
      note={
        isFiltering(filter)
          ? 'الفلترة شغّالة: الرصيد محسوب على القيود المعروضة بس، من غير الرصيد الافتتاحي للبنك. القيود المعتمدة بس.'
          : 'الرصيد = الرصيد الافتتاحي للبنك + الوارد − المصروف. الوارد والمصروف فيهم التحويلات بين البنوك. القيود المعتمدة بس.'
      }
    />
  )
}
