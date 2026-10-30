import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Segmented from '../../components/Segmented'
import Progress from '../../components/Progress'
import { money, TYPE_LABEL } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries, isOver, percentOf, type ProjectSummary } from '../../lib/projects'
import ProjectDialog from './ProjectDialog'
import StatusChip from './StatusChip'

const STATUS = [
  { value: 'all', label: 'الكل' },
  { value: 'active', label: 'نشط' },
  { value: 'closed', label: 'مقفول' },
] as const
const TYPES = [
  { value: 'all', label: 'كل الأنواع' },
  { value: 'finishing', label: TYPE_LABEL.finishing },
  { value: 'furnishing', label: TYPE_LABEL.furnishing },
] as const

export default function Projects() {
  const { can } = useAuth()
  const canEdit = can('projects', 'edit')
  const { data, failed, loading, reload } = useAsync<ProjectSummary[]>(fetchSummaries)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof STATUS)[number]['value']>('all')
  const [type, setType] = useState<(typeof TYPES)[number]['value']>('all')
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (data ?? []).filter(
      (p) =>
        (status === 'all' || p.status === status) &&
        (type === 'all' || p.type === type) &&
        (!term || p.name.toLowerCase().includes(term)),
    )
  }, [data, q, status, type])

  const overCount = rows.filter(isOver).length
  const total = (f: (p: ProjectSummary) => number) => rows.reduce((s, p) => s + f(p), 0)

  return (
    <div className="page-stack">
      <PageHead
        title="المشاريع"
        actions={
          canEdit && (
            <button className="btn btn-icon" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              مشروع جديد
            </button>
          )
        }
      />

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المشروع"
            aria-label="ابحث باسم المشروع"
          />
        </label>
        <Segmented label="الحالة" value={status} options={STATUS} onChange={setStatus} />
        <Segmented label="النوع" value={type} options={TYPES} onChange={setType} />
        <span className="toolbar-note muted small">
          {rows.length} مشروع{overCount > 0 ? ` · ${overCount} تجاوز الميزانية` : ''}
        </span>
      </div>

      {failed && <p className="msg msg-error">مقدرناش نحمّل المشاريع، جرّب تاني</p>}
      {loading && !data && <p className="muted">جارٍ التحميل...</p>}
      {data && rows.length === 0 && (
        <div className="card empty">{data.length === 0 ? 'مفيش مشاريع لسه.' : 'مفيش مشروع بالشروط دي.'}</div>
      )}

      {rows.length > 0 && (
        <>
          <section className="panel proj-table">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>المشروع</th>
                    <th>النوع</th>
                    <th>الميزانية</th>
                    <th>الوارد</th>
                    <th>المصروف</th>
                    <th>الرصيد</th>
                    <th>الاستهلاك</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const bal = p.income - p.expenses
                    return (
                      <tr key={p.id}>
                        <td className="strong">
                          <a className="row-link" href={`#/projects/${p.id}`}>
                            {p.name}
                          </a>
                        </td>
                        <td>
                          <span className="chip chip-neutral">{TYPE_LABEL[p.type]}</span>
                        </td>
                        <td className="num">{money(p.budget)}</td>
                        <td className="num">{money(p.income)}</td>
                        <td className="num">{money(p.expenses)}</td>
                        <td className={`num strong ${bal >= 0 ? 'tone-text-ok' : 'tone-text-err'}`}>{money(bal)}</td>
                        <td className="usage">
                          {p.budget > 0 ? (
                            <>
                              <Progress percent={percentOf(p)} over={isOver(p)} />
                              <span className={isOver(p) ? 'tone-text-err' : 'muted'}>{percentOf(p)}%</span>
                            </>
                          ) : (
                            <span className="muted small">بدون ميزانية</span>
                          )}
                        </td>
                        <td>
                          <StatusChip p={p} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="strong" colSpan={2}>
                      الإجمالي
                    </td>
                    <td className="num strong">{money(total((p) => p.budget))}</td>
                    <td className="num strong">{money(total((p) => p.income))}</td>
                    <td className="num strong">{money(total((p) => p.expenses))}</td>
                    <td className="num strong">{money(total((p) => p.income - p.expenses))}</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="proj-cards" aria-label="المشاريع">
            {rows.map((p) => {
              const bal = p.income - p.expenses
              return (
                <a key={p.id} className="proj-card" href={`#/projects/${p.id}`}>
                  <div className="proj-card-top">
                    <span className="strong">{p.name}</span>
                    <StatusChip p={p} />
                  </div>
                  <span className="chip chip-neutral">{TYPE_LABEL[p.type]}</span>
                  {p.budget > 0 && <Progress percent={percentOf(p)} over={isOver(p)} />}
                  <div className="proj-card-line muted small">
                    <span>
                      مصروف {money(p.expenses)} من {money(p.budget)}
                    </span>
                    {p.budget > 0 && (
                      <span className={isOver(p) ? 'tone-text-err strong' : 'strong'}>{percentOf(p)}%</span>
                    )}
                  </div>
                  <div className="proj-card-bal">
                    <span className="muted">الرصيد</span>
                    <span className={`strong ${bal >= 0 ? 'tone-text-ok' : 'tone-text-err'}`}>{money(bal)} ج.م</span>
                  </div>
                </a>
              )
            })}
          </section>
        </>
      )}

      {adding && <ProjectDialog onClose={() => setAdding(false)} onSaved={reload} />}
    </div>
  )
}
