import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell } from '../../lib/tableTypes'
import { fetchBankMovements, type BankMovement } from '../../lib/banks'
import { money, periodText, todayISO } from '../../lib/format'
import { runLedger } from '../../lib/reportBuilders'
import { useAsync } from '../../lib/useAsync'
import { toCents } from '../../lib/money'


/** One bank account: balance before the period, every movement with its running balance, and the closing balance. */
export default function BankStatement({ id, name, opening, from, to }: { id: string; name: string; opening: number; from: string; to: string }) {
  const load = useCallback(() => fetchBankMovements(id), [id])
  const { data, failed } = useAsync<BankMovement[]>(load)

  const view = useMemo(() => {
    if (!data) return null
    const ledger = runLedger(opening, data.map((m) => ({ ...m, date: m.entry_date, delta: m.kind === 'income' ? m.amount : -m.amount })), from, to)
    const sum = (kind: 'income' | 'expense') => ledger.rows.filter((r) => r.kind === kind).reduce((s, r) => s + toCents(r.amount), 0) / 100
    return { ledger, income: sum('income'), expense: sum('expense') }
  }, [data, opening, from, to])

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
      m.kind === 'income' ? m.amount : null,
      m.kind === 'expense' ? m.amount : null,
      m.run,
    ]),
  ]

  return (
    <TableReport
      title={`كشف حساب بنك: ${name}`}
      filename={`المصباح - كشف بنك ${name} - ${todayISO()}.xlsx`}
      meta={[
        { label: 'البنك', value: name },
        { label: 'الفترة', value: periodText(from, to) },
      ]}
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
      note="الرصيد = الرصيد الافتتاحي للبنك + الوارد − المصروف. القيود المعتمدة بس."
    />
  )
}
