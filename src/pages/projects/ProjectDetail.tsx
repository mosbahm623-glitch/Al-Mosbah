import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Segmented from '../../components/Segmented'
import Progress from '../../components/Progress'
import { supabase } from '../../lib/supabase'
import { dateText, money, TYPE_LABEL } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { isOver, percentOf, type Entry, type ProjectSummary } from './types'
import StatusChip from './StatusChip'
import { fetchSummaries } from './data'
import ProjectDialog from './ProjectDialog'
import EntryDialog from './EntryDialog'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const

export default function ProjectDetail({ id }: { id: string }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const fetchEntries = useCallback(
    () =>
      supabase
        .from('entries')
        .select('id,seq,kind,category,item,amount,entry_date,notes,contractor:contractors(name)')
        .eq('project_id', id)
        .order('seq', { ascending: false })
        .returns<Entry[]>(),
    [id],
  )
  const summaries = useAsync<ProjectSummary[]>(fetchSummaries)
  const entries = useAsync<Entry[]>(fetchEntries)
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  const [dialog, setDialog] = useState<'entry' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  const project = summaries.data?.find((p) => p.id === id)
  const shown = useMemo(() => (entries.data ?? []).filter((e) => kind === 'all' || e.kind === kind), [entries.data, kind])

  function reloadAll() {
    summaries.reload()
    entries.reload()
  }

  if (summaries.loading && !summaries.data) return <p className="muted">جارٍ التحميل...</p>
  if (summaries.failed) return <p className="msg msg-error">مقدرناش نحمّل المشروع، جرّب تاني</p>
  if (!project) {
    return (
      <div className="page-stack">
        <h1 className="page-title">المشروع مش موجود</h1>
        <a className="btn btn-ghost" href="#/projects">رجوع للمشاريع</a>
      </div>
    )
  }

  const balance = project.income - project.expenses
  const over = isOver(project)

  return (
    <div className="page-stack">
      <div className="page-head">
        <div>
          <nav className="crumbs" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <span aria-hidden="true">‹</span>
            <a href="#/projects">المشاريع</a>
            <span aria-hidden="true">‹</span>
            <span className="crumb-current">{project.name}</span>
          </nav>
          <div className="title-row">
            <h1 className="page-title">{project.name}</h1>
            <span className="chip chip-neutral">{TYPE_LABEL[project.type]}</span>
            <StatusChip p={project} />
          </div>
        </div>
        {isAdmin && (
          <div className="head-actions">
            <button className="btn btn-ghost btn-icon" onClick={() => setDialog('edit')}>
              <Pencil size={18} aria-hidden="true" />
              تعديل
            </button>
            <button className="btn btn-icon" onClick={() => setDialog('entry')}>
              <Plus size={18} aria-hidden="true" />
              قيد جديد
            </button>
          </div>
        )}
      </div>

      <section className="stats">
        <div className="stat"><span className="muted small">الميزانية</span><strong>{money(project.budget)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الوارد</span><strong className="tone-text-ok">{money(project.income)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">المصروف</span><strong className="tone-text-err">{money(project.expenses)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الرصيد</span><strong className={balance >= 0 ? 'tone-text-ok' : 'tone-text-err'}>{money(balance)}<small>ج.م</small></strong></div>
      </section>

      {project.budget > 0 && (
        <section className="panel usage-panel">
          <div className="usage-head">
            <span className="strong">استهلاك الميزانية</span>
            <span className={over ? 'tone-text-err strong' : 'muted'}>
              {percentOf(project)}%{over ? ` · تجاوز ${money(project.expenses - project.budget)} ج.م` : ''}
            </span>
          </div>
          <Progress percent={percentOf(project)} over={over} />
        </section>
      )}

      <div className="toolbar">
        <h2 className="section-title">القيود</h2>
        <Segmented label="نوع القيد" value={kind} options={KINDS} onChange={setKind} />
        <span className="toolbar-note muted small">{shown.length} قيد</span>
      </div>

      {entries.failed && <p className="msg msg-error">مقدرناش نحمّل القيود، جرّب تاني</p>}
      {entries.data && shown.length === 0 && <div className="card empty">مفيش قيود.</div>}
      {shown.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>البند</th>
                  <th>اسم المصروف</th>
                  <th>المقاول</th>
                  <th>ملاحظات</th>
                  <th>المبلغ</th>
                  {isAdmin && <th><span className="sr-only">إجراءات</span></th>}
                </tr>
              </thead>
              <tbody>
                {shown.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">{dateText(e.entry_date)}</td>
                    <td>
                      <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        <span className="dot" />
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                    </td>
                    <td>{e.category}</td>
                    <td>{e.item}</td>
                    <td>{e.contractor?.name}</td>
                    <td className="muted">{e.notes}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {e.kind === 'income' ? '+' : '−'}
                      {money(e.amount)}
                    </td>
                    {isAdmin && (
                      <td>
                        <button type="button" className="icon-btn" aria-label={`تعديل القيد ${e.seq}`} onClick={() => setEditing(e)}>
                          <Pencil size={17} />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dialog === 'entry' && (
        <EntryDialog projectId={id} projectName={project.name} onClose={() => setDialog(null)} onSaved={reloadAll} />
      )}
      {editing && (
        <EntryDialog projectId={id} projectName={project.name} entry={editing} onClose={() => setEditing(null)} onSaved={reloadAll} />
      )}
      {dialog === 'edit' && <ProjectDialog project={project} onClose={() => setDialog(null)} onSaved={reloadAll} />}
    </div>
  )
}
