import { useMemo, useState } from 'react'
import { ArrowRight, FileSpreadsheet, Printer } from 'lucide-react'
import { dateText, money, TYPE_LABEL } from '../../lib/format'
import { useProjectData } from '../../lib/useProjectData'
import { exportProjectExcel } from '../../lib/exportProjectExcel'
import { isOver, percentOf, type Entry } from '../../lib/projects'

type Group = { name: string; rows: Entry[]; total: number }

export default function ProjectReport({ id }: { id: string }) {
  const { project, entries: allEntries, loading, failed: loadFailed } = useProjectData(id)
  // only approved entries count in the report
  const entries = useMemo(() => allEntries?.filter((e) => e.status === 'approved'), [allEntries])
  const [withContractor, setWithContractor] = useState(true)
  const [bankWanted, setBankWanted] = useState(true)
  const [withNotes, setWithNotes] = useState(true)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [today] = useState(() => new Date().toLocaleDateString('en-GB').replaceAll('/', '-'))

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
  const cols = 4 + (withContractor ? 1 : 0) + (withBank ? 1 : 0) + (withNotes ? 1 : 0)

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
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {busy ? 'جارٍ التجهيز...' : 'Excel'}
          </button>
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
          </dl>
        </header>

        <table className="paper-table summary">
          <thead>
            <tr>
              <th>الميزانية</th>
              <th>الوارد</th>
              <th>المصروف</th>
              <th>الرصيد</th>
              <th>استهلاك الميزانية</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="num">{money(project.budget)}</td>
              <td className="num">{money(project.income)}</td>
              <td className="num">{money(project.expenses)}</td>
              <td className={`num strong ${balance < 0 ? 'neg' : ''}`}>{money(balance)}</td>
              <td className={isOver(project) ? 'neg strong' : ''}>{project.budget > 0 ? `${percentOf(project)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>

        {incomes.length > 0 && (
          <>
            <h2>الوارد</h2>
            <table className="paper-table group">
              <thead>
                <tr>
                  <th className="w-seq">رقم</th>
                  <th className="w-date">التاريخ</th>
                  <th>البيان</th>
                  {withNotes && <th>ملاحظات</th>}
                  <th className="w-amount">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {incomes.map((e) => (
                  <tr key={e.id}>
                    <td className="num">{e.seq}</td>
                    <td className="num">{dateText(e.entry_date)}</td>
                    <td>{e.category}</td>
                    {withNotes && <td>{e.notes}</td>}
                    <td className="num">{money(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={withNotes ? 4 : 3}>إجمالي الوارد</td>
                  <td className="num">{money(incomeTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
        <h2>المصروفات حسب البند</h2>
        {expenseGroups.length === 0 && <p className="muted">مفيش مصروفات.</p>}
        {expenseGroups.map((g) => (
          <table key={g.name} className="paper-table group">
            <thead>
              <tr className="group-title">
                <th colSpan={cols}>
                  {g.name} <span className="count">({g.rows.length} قيد)</span>
                </th>
              </tr>
              <tr>
                <th className="w-seq">رقم</th>
                <th className="w-date">التاريخ</th>
                <th>اسم المصروف</th>
                {withContractor && <th>المقاول</th>}
                {withBank && <th>البنك</th>}
                {withNotes && <th>ملاحظات</th>}
                <th className="w-amount">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((e) => (
                <tr key={e.id}>
                  <td className="num">{e.seq}</td>
                  <td className="num">{dateText(e.entry_date)}</td>
                  <td>{e.item}</td>
                  {withContractor && <td>{e.contractor?.name}</td>}
                  {withBank && <td>{e.bank?.name}</td>}
                  {withNotes && <td>{e.notes}</td>}
                  <td className="num">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={cols - 1}>إجمالي {g.name}</td>
                <td className="num">{money(g.total)}</td>
              </tr>
            </tfoot>
          </table>
        ))}
        {expenseGroups.length > 0 && (
          <table className="paper-table grand">
            <tbody>
              <tr>
                <td>إجمالي المصروفات</td>
                <td className="num">{money(project.expenses)}</td>
              </tr>
            </tbody>
          </table>
        )}

        <footer className="paper-foot">المصباح · {project.name} · {today}</footer>
      </article>
    </div>
  )
}
