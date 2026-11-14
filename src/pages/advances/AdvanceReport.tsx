import { useState } from 'react'
import { ArrowRight, Printer } from 'lucide-react'
import { advanceBalance } from '../../lib/advances'
import { money, todayText } from '../../lib/format'
import { useAdvanceData } from '../../lib/useAdvanceData'
import { Kpis, Signatures } from '../../components/PaperExtras'
import DataGrid from '../../components/DataGrid'
import PrintTables from '../../components/PrintTables'
import type { Section } from '../../lib/tableTypes'
import { usePreparedBy } from '../../auth/usePreparedBy'
import { enteredByOf } from '../../lib/enteredBy'
import { toCents } from '../../lib/money'
import { NO_FILTER, filterMeta, isFiltering, matches, type ReportFilter } from '../../lib/reportFilter'

const spentSum = (rows: { amount: number }[]) => rows.reduce((t, e) => t + toCents(e.amount), 0) / 100

type Parts = { given: boolean; spent: boolean; returned: boolean }

/** Printable statement of one custody: what the holder received, spent (per project) and returned. */
export default function AdvanceReport({
  id,
  embedded,
  filter = NO_FILTER,
}: {
  id: string
  filter?: ReportFilter
  embedded?: { withContractor: boolean; withNotes: boolean; withEnteredBy?: boolean; parts?: Parts }
}) {
  const preparedBy = usePreparedBy()
  const withContractor = embedded?.withContractor ?? true
  const withNotes = embedded?.withNotes ?? true
  const withEnteredBy = embedded?.withEnteredBy ?? true
  // which parts of the statement to show (all by default)
  const parts = embedded?.parts ?? { given: true, spent: true, returned: true }
  const { advance, installments, returns, entries, loading, failed } = useAdvanceData(id)
  const [today] = useState(() => todayText())

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الكشف، جرّب تاني</p>
  if (!advance) return <p className="msg msg-error">العهدة مش موجودة</p>

  const balance = advanceBalance(advance)
  const narrowed = isFiltering(filter)
  const spent = [...(entries ?? [])]
    .filter(
      (e) =>
        e.status === 'approved' &&
        matches(filter, { project: e.project?.name, contractor: e.contractor?.name, category: e.category }),
    )
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.seq - b.seq)
  const given = [...(installments ?? [])]
    .filter((i) => i.status === 'approved')
    .sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  const spentTotal = narrowed ? spentSum(spent) : advance.spent
  const back = [...(returns ?? [])].sort((a, b) => a.returned_on.localeCompare(b.returned_on))

  const allSections: (Section & { part: keyof Parts })[] = [
    {
      part: 'given',
      heading: 'الدفعات المستلمة',
      cols: [
        { h: 'التاريخ', kind: 'date' },
        { h: 'المبلغ', kind: 'money' },
      ],
      rows: given.map((i) => [i.paid_on, i.amount]),
      footer: ['إجمالي المستلم', advance.given],
      empty: 'مفيش دفعات.',
    },
    {
      part: 'spent',
      heading: 'المصروفات',
      cols: [
        { h: 'رقم', kind: 'int' },
        { h: 'التاريخ', kind: 'date' },
        { h: 'المشروع' },
        { h: 'البند' },
        { h: 'البيان' },
        ...(withContractor ? [{ h: 'المقاول' }] : []),
        ...(withEnteredBy ? [{ h: 'المدخل' }] : []),
        ...(withNotes ? [{ h: 'ملاحظات' }] : []),
        { h: 'المبلغ', kind: 'money' as const },
      ],
      rows: spent.map((e) => [
        e.seq,
        e.entry_date,
        e.project?.name ?? null,
        e.category,
        e.item,
        ...(withContractor ? [e.contractor?.name ?? null] : []),
        ...(withEnteredBy ? [enteredByOf(e)] : []),
        ...(withNotes ? [e.notes] : []),
        e.amount,
      ]),
      footer: [
        'إجمالي المصروف',
        ...Array(4 + (withContractor ? 1 : 0) + (withNotes ? 1 : 0) + (withEnteredBy ? 1 : 0)).fill(null),
        spentTotal,
      ],
      empty: 'مفيش مصروفات.',
    },
    ...(back.length > 0
      ? [
          {
            part: 'returned' as const,
            heading: 'المرتجع',
            cols: [{ h: 'التاريخ', kind: 'date' as const }, { h: 'ملاحظات' }, { h: 'المبلغ', kind: 'money' as const }],
            rows: back.map((r) => [r.returned_on, r.notes, r.amount]),
            footer: ['إجمالي المرتجع', null, advance.returned],
          },
        ]
      : []),
  ]

  const gridSections: Section[] = allSections.filter((s) => parts[s.part]).map(({ part: _part, ...s }) => s)

  return (
    <div className="page-stack report-page">
      <div className="report-bar no-print">
        {!embedded && (
          <a className="btn btn-ghost btn-icon" href={`#/advances/${id}`}>
            <ArrowRight size={18} aria-hidden="true" />
            رجوع للعهدة
          </a>
        )}
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
        </div>
      </div>

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>كشف عهدة: {advance.holder_name}</h1>
          </div>
          <dl className="paper-meta">
            <div>
              <dt>الحالة</dt>
              <dd>{advance.status === 'open' ? 'مفتوحة' : 'مقفولة'}</dd>
            </div>
            {filterMeta(filter).map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
            <div>
              <dt>تاريخ الكشف</dt>
              <dd>{today}</dd>
            </div>
            {preparedBy && (
              <div>
                <dt>أعدّه</dt>
                <dd>{preparedBy}</dd>
              </div>
            )}
          </dl>
        </header>

        <Kpis
          items={[
            { label: 'المستلم', value: money(advance.given), tone: 'ok' },
            { label: narrowed ? 'المصروف (بالفلتر)' : 'المصروف', value: money(spentTotal), tone: 'err' },
            { label: 'المرتجع', value: money(advance.returned), tone: 'warn' },
            { label: 'المتبقي مع المستلم', value: money(balance), tone: 'neutral', neg: balance < 0 },
          ]}
        />

        <div className="screen-only">
          {gridSections.map((g) => (
            <DataGrid key={g.heading} section={g} />
          ))}
          <p className="grid-total">
            المتبقي مع المستلم (المستلم − المصروف − المرتجع):{' '}
            <b className={balance < 0 ? 'neg' : ''}>{money(balance)}</b>
          </p>
        </div>

        <PrintTables sections={gridSections} />
        <div className="print-only">
          <table className="paper-table grand">
            <tbody>
              <tr>
                <td>المتبقي مع المستلم (المستلم − المصروف − المرتجع)</td>
                <td className="num">{money(balance)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Signatures />

        <footer className="paper-foot">
          المصباح · عهدة {advance.holder_name} · {today}
        </footer>
      </article>
    </div>
  )
}
