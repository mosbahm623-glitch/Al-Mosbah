import { useState } from 'react'
import { FileText, Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Progress from '../../components/Progress'
import { money, TYPE_LABEL } from '../../lib/format'
import { useProjectData } from '../../lib/useProjectData'
import { isOver, percentOf, type Entry } from '../../lib/projects'
import StatusChip from './StatusChip'
import ProjectDialog from './ProjectDialog'
import EntryDialog from './EntryDialog'
import EntryList from './EntryList'

export default function ProjectDetail({ id }: { id: string }) {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const { project, projects, entries, loading, failed, reload } = useProjectData(id)
  const [dialog, setDialog] = useState<'entry' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (failed) return <p className="msg msg-error">مقدرناش نحمّل المشروع، جرّب تاني</p>
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
        <div className="head-actions">
          {(projects?.length ?? 0) > 1 && (
            <label className="switcher">
              <span className="sr-only">تبديل المشروع</span>
              <select value={id} onChange={(e) => { window.location.hash = `#/projects/${e.target.value}` }}>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <a className="btn btn-ghost btn-icon" href={`#/projects/${id}/report`}>
            <FileText size={18} aria-hidden="true" />
            تقرير / تصدير
          </a>
          {isAdmin && (<>
            <button className="btn btn-ghost btn-icon" onClick={() => setDialog('edit')}>
              <Pencil size={18} aria-hidden="true" />
              تعديل
            </button>
            <button className="btn btn-icon" onClick={() => setDialog('entry')}>
              <Plus size={18} aria-hidden="true" />
              قيد جديد
            </button>
          </>)}
        </div>
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

      {entries && <EntryList entries={entries} isAdmin={isAdmin} onEdit={setEditing} />}

      {dialog === 'entry' && (
        <EntryDialog projectId={id} projectName={project.name} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {editing && (
        <EntryDialog projectId={id} projectName={project.name} projects={projects} entry={editing} onClose={() => setEditing(null)} onSaved={reload} />
      )}
      {dialog === 'edit' && <ProjectDialog project={project} onClose={() => setDialog(null)} onSaved={reload} />}
    </div>
  )
}
