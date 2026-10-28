import { useMemo, useState } from 'react'
import { BookOpen, FileSpreadsheet, Printer } from 'lucide-react'
import PageHead from '../../components/PageHead'
import Segmented from '../../components/Segmented'
import { money, todayText, TYPE_LABEL } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries, isOver, percentOf, type ProjectSummary } from '../../lib/projects'
import { fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances'
import { balanceOf, filterProjects, totalsOf, type StatusFilter, type TypeFilter } from '../../lib/reports'
import { exportAggregateExcel } from '../../lib/exportAggregateExcel'

const STATUS: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'closed', label: 'مقفول' },
]
const TYPES: readonly { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'finishing', label: TYPE_LABEL.finishing },
  { value: 'furnishing', label: TYPE_LABEL.furnishing },
]

const scopeText = (status: StatusFilter, type: TypeFilter, picked: number, shown: number) =>
  [
    type === 'all' ? 'كل الأنواع' : TYPE_LABEL[type],
    status === 'all' ? 'نشط ومقفول' : status === 'active' ? 'النشطة فقط' : 'المقفولة فقط',
    picked < shown ? `${picked} من ${shown} مشروع` : `${shown} مشروع`,
  ].join(' · ')

export default function Reports() {
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const [projectId, setProjectId] = useState('')
  const [advanceId, setAdvanceId] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<TypeFilter>('all')
  const [left, setLeft] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [today] = useState(() => todayText())

  const all = projects.data
  const candidates = useMemo(() => filterProjects(all ?? [], status, type), [all, status, type])
  const rows = useMemo(() => candidates.filter((p) => !left.has(p.id)), [candidates, left])
  const totals = useMemo(() => totalsOf(rows), [rows])
  const scope = scopeText(status, type, rows.length, candidates.length)

  const toggle = (id: string) =>
    setLeft((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  async function excel() {
    setBusy(true)
    setFailed(false)
    try {
      await exportAggregateExcel({ rows, scope })
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  const pickedProject = projectId || all?.[0]?.id || ''
  const pickedAdvance = advanceId || advances.data?.[0]?.id || ''

  return (
    <div className="page-stack report-page">
      <div className="no-print">
        <PageHead title="التقارير والتصدير" />
      </div>

      {(projects.failed || advances.failed) && <p className="msg msg-error no-print">مقدرناش نحمّل البيانات، جرّب تاني</p>}
      {projects.loading && !all && <p className="muted no-print">جارٍ التحميل...</p>}

      <section className="panel no-print">
        <div className="panel-head">
          <h2>اليومية</h2>
          <a className="btn btn-icon" href="#/reports/journal">
            <BookOpen size={18} aria-hidden="true" />
            فتح اليومية
          </a>
        </div>
        <p className="muted small">كل حركات يوم معين: وارد ومصروف وعهد ومقاولين، مع طباعة وExcel.</p>
      </section>

      {all && (
        <section className="panel no-print">
          <div className="panel-head">
            <h2>تقرير تفصيلي</h2>
          </div>
          <div className="report-open">
            <label className="field">
              مشروع
              <select value={pickedProject} onChange={(e) => setProjectId(e.target.value)} disabled={all.length === 0}>
                {all.length === 0 && <option value="">مفيش مشاريع</option>}
                {all.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <a className="btn" href={`#/projects/${pickedProject}/report`} aria-disabled={!pickedProject}>
              تقرير المشروع
            </a>
            <label className="field">
              عهدة
              <select value={pickedAdvance} onChange={(e) => setAdvanceId(e.target.value)} disabled={!advances.data?.length}>
                {!advances.data?.length && <option value="">مفيش عهد</option>}
                {advances.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.holder_name}
                    {a.status === 'closed' ? ' (مقفولة)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <a className="btn" href={`#/advances/${pickedAdvance}/report`} aria-disabled={!pickedAdvance}>
              تقرير العهدة
            </a>
          </div>
        </section>
      )}

      {all && (
        <>
          <section className="panel no-print">
            <div className="panel-head">
              <h2>تقرير مجمّع لكل المشاريع</h2>
              <div className="head-actions">
                <button className="btn btn-icon" onClick={() => window.print()} disabled={rows.length === 0}>
                  <Printer size={18} aria-hidden="true" />
                  طباعة / PDF
                </button>
                <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy || rows.length === 0}>
                  <FileSpreadsheet size={18} aria-hidden="true" />
                  {busy ? 'جارٍ التجهيز...' : 'Excel'}
                </button>
              </div>
            </div>
            <div className="toolbar">
              <Segmented label="الحالة" value={status} options={STATUS} onChange={setStatus} />
              <Segmented label="النوع" value={type} options={TYPES} onChange={setType} />
            </div>
            {candidates.length > 1 && (
              <div className="pick-list" role="group" aria-label="المشاريع في التقرير">
                {candidates.map((p) => (
                  <label key={p.id} className="check">
                    <input type="checkbox" checked={!left.has(p.id)} onChange={() => toggle(p.id)} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </section>
          {failed && <p className="msg msg-error no-print">ملف الإكسل ما اتجهزش، جرّب تاني</p>}

          <article className="paper">
            <header className="paper-head">
              <div>
                <div className="paper-brand">المصباح</div>
                <h1>تقرير مجمّع للمشاريع</h1>
              </div>
              <dl className="paper-meta">
                <div><dt>النطاق</dt><dd>{scope}</dd></div>
                <div><dt>تاريخ التقرير</dt><dd>{today}</dd></div>
              </dl>
            </header>

            {rows.length === 0 ? (
              <p className="muted">مفيش مشاريع بالشروط دي.</p>
            ) : (
              <table className="paper-table group">
                <thead>
                  <tr>
                    <th className="w-seq">م</th>
                    <th>المشروع</th>
                    <th>النوع</th>
                    <th>الحالة</th>
                    <th className="w-amount">الميزانية</th>
                    <th className="w-amount">الوارد</th>
                    <th className="w-amount">المصروف</th>
                    <th className="w-amount">الرصيد</th>
                    <th>الاستهلاك</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p, i) => {
                    const balance = balanceOf(p)
                    return (
                      <tr key={p.id}>
                        <td className="num">{i + 1}</td>
                        <td>{p.name}</td>
                        <td>{TYPE_LABEL[p.type]}</td>
                        <td>{p.status === 'active' ? 'نشط' : 'مقفول'}</td>
                        <td className="num">{money(p.budget)}</td>
                        <td className="num">{money(p.income)}</td>
                        <td className="num">{money(p.expenses)}</td>
                        <td className={`num ${balance < 0 ? 'neg strong' : ''}`}>{money(balance)}</td>
                        <td className={`num ${isOver(p) ? 'neg strong' : ''}`}>{p.budget > 0 ? `${percentOf(p)}%` : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>الإجمالي ({totals.count} مشروع)</td>
                    <td className="num">{money(totals.budget)}</td>
                    <td className="num">{money(totals.income)}</td>
                    <td className="num">{money(totals.expenses)}</td>
                    <td className={`num ${totals.balance < 0 ? 'neg' : ''}`}>{money(totals.balance)}</td>
                    <td className="num">{totals.budget > 0 ? `${Math.round((totals.expenses / totals.budget) * 100)}%` : '—'}</td>
                  </tr>
                </tfoot>
              </table>
            )}
            {totals.over > 0 && <p className="neg">{totals.over} مشروع تجاوز الميزانية</p>}

            <footer className="paper-foot">المصباح · تقرير مجمّع · {today}</footer>
          </article>
        </>
      )}
    </div>
  )
}
