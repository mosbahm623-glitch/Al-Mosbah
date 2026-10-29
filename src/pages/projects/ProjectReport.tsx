import { useMemo, useState } from 'react'
import { ArrowRight, FileSpreadsheet, MessageCircle, Printer } from 'lucide-react'
import { money, todayText, TYPE_LABEL } from '../../lib/format'
import { useProjectData } from '../../lib/useProjectData'
import { exportProjectExcel } from '../../lib/exportProjectExcel'
import { reportSummaryText, whatsappLink } from '../../lib/whatsapp'
import { isOver, percentOf, type Entry } from '../../lib/projects'
import { Kpis, Signatures } from '../../components/PaperExtras'
import DataGrid from '../../components/DataGrid'
import PrintTables from '../../components/PrintTables'
import type { Section } from '../../lib/tableTypes'
import type { ReportColumns } from '../../lib/reportColumns'
import { usePreparedBy } from '../../auth/usePreparedBy'


type Group = { name: string; rows: Entry[]; total: number }

/** `embedded`: shown inside the reports page, which owns the column choices and the back navigation. */
export default function ProjectReport({ id, embedded }: { id: string; embedded?: ReportColumns }) {
  const preparedBy = usePreparedBy()
  const { project, entries: allEntries, loading, failed: loadFailed } = useProjectData(id)
  // only approved entries count in the report
  const entries = useMemo(() => allEntries?.filter((e) => e.status === 'approved'), [allEntries])
  const [ownContractor, setWithContractor] = useState(true)
  const [ownBank, setBankWanted] = useState(true)
  const [ownNotes, setWithNotes] = useState(true)
  const withContractor = embedded ? embedded.withContractor : ownContractor
  const bankWanted = embedded ? embedded.withBank : ownBank
  const withNotes = embedded ? embedded.withNotes : ownNotes
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [today] = useState(() => todayText())

  const { expenseGroups, incomes } = useMemo(() => {
    const map = new Map<string, Group>()
    const inc: Entry[] = []
    for (const e of [...(entries ?? [])].sort((a, b) => a.seq - b.seq)) {
      if (e.kind === 'income') {
        inc.push(e)
        continue
      }
      const g = map.get(e.category) ?? { name: e.category, rows: [], total: 0 }
      g.rows.push(e)
      g.total += e.amount
      map.set(e.category, g)
    }
    return { expenseGroups: [...map.values()].sort((a, b) => b.total - a.total), incomes: inc }
  }, [entries])

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (loadFailed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!project || !entries) return <p className="msg msg-error">المشروع مش موجود</p>

  const data = entries
  const balance = project.income - project.expenses
  const incomeTotal = incomes.reduce((s, e) => s + e.amount, 0)
  const hasBank = entries.some((e) => e.bank)
  const withBank = bankWanted && hasBank

  // the same tables for the screen: sortable and filterable (print keeps the paper tables below)
  const incomeSections: Section[] = []
  const groupSections: Section[] = []
  const entryCols = (first: string) => [
    { h: 'رقم', kind: 'int' as const },
    { h: 'التاريخ', kind: 'date' as const },
    { h: first },
    ...(withContractor ? [{ h: 'المقاول' }] : []),
    ...(withBank ? [{ h: 'البنك' }] : []),
    ...(withNotes ? [{ h: 'ملاحظات' }] : []),
    { h: 'المبلغ', kind: 'money' as const },
  ]
  const entryRow = (e: Entry, first: string | null) => [
    e.seq,
    e.entry_date,
    first,
    ...(withContractor ? [e.contractor?.name ?? null] : []),
    ...(withBank ? [e.bank?.name ?? null] : []),
    ...(withNotes ? [e.notes] : []),
    e.amount,
  ]
  const footerOf = (label: string, total: number, n: number) => [label, ...Array(n - 2).fill(null), total]
  if (incomes.length > 0) {
    const c = entryCols('البيان').filter((x) => x.h !== 'المقاول' && x.h !== 'البنك')
    incomeSections.push({
      heading: 'الوارد',
      cols: c,
      rows: incomes.map((e) => [e.seq, e.entry_date, e.category, ...(withNotes ? [e.notes] : []), e.amount]),
      footer: footerOf('إجمالي الوارد', incomeTotal, c.length),
    })
  }
  for (const g of expenseGroups) {
    const c = entryCols('البيان')
    groupSections.push({
      heading: `${g.name} (${g.rows.length} قيد)`,
      cols: c,
      rows: g.rows.map((e) => entryRow(e, e.item)),
      footer: footerOf(`إجمالي ${g.name}`, g.total, c.length),
    })
  }

  async function excel() {
    if (!project) return
    setBusy(true)
    setFailed(false)
    try {
      await exportProjectExcel({ project, entries: data, withContractor, withBank, withNotes })
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  return (
    <div className="page-stack report-page">
      <div className="report-bar no-print">
        {!embedded && (
          <>
        <a className="btn btn-ghost btn-icon" href={`#/projects/${id}`}>
          <ArrowRight size={18} aria-hidden="true" />
          رجوع للمشروع
        </a>
        <label className="check">
          <input type="checkbox" checked={withContractor} onChange={(e) => setWithContractor(e.target.checked)} />
          المقاول
        </label>
        {hasBank && (
          <label className="check">
            <input type="checkbox" checked={bankWanted} onChange={(e) => setBankWanted(e.target.checked)} />
            البنك
          </label>
        )}
        <label className="check">
          <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />
          الملاحظات
        </label>
          </>
        )}
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {busy ? 'جارٍ التجهيز...' : 'Excel'}
          </button>
          <a
            className="btn btn-ghost btn-icon"
            href={whatsappLink(
              reportSummaryText(project.name, [
                { label: 'الوارد', value: money(incomeTotal) },
                { label: 'المصروف', value: money(project.expenses) },
                { label: 'الرصيد', value: money(balance) },
              ]),
            )}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle size={18} aria-hidden="true" />
            واتساب
          </a>
        </div>
      </div>
      {failed && <p className="msg msg-error no-print">ملف الإكسل ما اتجهزش، جرّب تاني</p>}

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>تقرير مشروع: {project.name}</h1>
          </div>
          <dl className="paper-meta">
            <div><dt>النوع</dt><dd>{TYPE_LABEL[project.type]}</dd></div>
            <div><dt>الحالة</dt><dd>{project.status === 'active' ? 'نشط' : 'مقفول'}</dd></div>
            <div><dt>تاريخ التقرير</dt><dd>{today}</dd></div>
            {preparedBy && <div><dt>أعدّه</dt><dd>{preparedBy}</dd></div>}
          </dl>
        </header>

        <Kpis
          items={[
            { label: 'الميزانية', value: money(project.budget) },
            { label: 'الوارد', value: money(project.income), tone: 'ok' },
            { label: 'المصروف', value: money(project.expenses), tone: 'err' },
            { label: 'الرصيد', value: money(balance), tone: 'neutral', neg: balance < 0 },
            { label: 'استهلاك الميزانية', value: project.budget > 0 ? `${percentOf(project)}%` : '—', tone: 'warn', neg: isOver(project) },
          ]}
        />

        <div className="screen-only">
          {incomeSections.length + groupSections.length === 0 ? <p className="muted">مفيش قيود.</p> : [...incomeSections, ...groupSections].map((g) => <DataGrid key={g.heading} section={g} />)}
          {expenseGroups.length > 0 && <p className="grid-total">إجمالي المصروفات: <b>{money(project.expenses)}</b></p>}
        </div>

        <PrintTables sections={incomeSections} />
        {expenseGroups.length > 0 && (
          <>
            <div className="print-only"><h2>المصروفات حسب البند</h2></div>
            <PrintTables sections={groupSections.map((g) => ({ ...g, bar: true }))} />
            <div className="print-only">
              <table className="paper-table grand">
                <tbody>
                  <tr>
                    <td>إجمالي المصروفات</td>
                    <td className="num">{money(project.expenses)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
        {expenseGroups.length === 0 && <div className="print-only"><h2>المصروفات حسب البند</h2><p className="muted">مفيش مصروفات.</p></div>}

        <Signatures />

        <footer className="paper-foot">المصباح · {project.name} · {today}</footer>
      </article>
    </div>
  )
}
