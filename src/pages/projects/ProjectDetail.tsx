import { useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { FileText, Link2, Pencil, Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Progress from '../../components/Progress'
import { money, TYPE_LABEL } from '../../lib/core/format'
import { useProjectData } from '../../lib/projects/useProjectData'
import { isOver, percentOf } from '../../lib/projects/projects'
import { type Entry } from '../../lib/entries/entryTypes'
import StatusChip from './StatusChip'
import ProjectDialog from './ProjectDialog'
import ShareDialog from './ShareDialog'
import EntryDialog from '../../components/EntryDialog'
import EntryList from './EntryList'

export default function ProjectDetail({ id }: { id: string }) {
  const { can, isStaff } = useAuth()
  const canEdit = can('projects', 'edit')
  const { project, projects, entries, loading, failed, reload } = useProjectData(id)
  const [dialog, setDialog] = useState<'entry' | 'edit' | 'share' | null>(null)
  const [editing, setEditing] = useState<Entry | null>(null)

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (failed) return <p className="msg msg-error">مقدرناش نحمّل المشروع، جرّب تاني</p>
  if (!project) {
    return (
      <div className="page-stack">
        <h1 className="page-title">المشروع مش موجود</h1>
        <a className="btn btn-ghost" href="#/projects">
          رجوع للمشاريع
        </a>
      </div>
    )
  }

  const balance = project.income - project.expenses
  const over = isOver(project)

  return (
    <div className="page-stack">
      <PageHead
        title={project.name}
        parent={{ label: 'المشاريع', href: '#/projects' }}
        chips={
          <>
            <span className="chip chip-neutral">{TYPE_LABEL[project.type]}</span>
            <StatusChip p={project} />
          </>
        }
        actions={
          <>
            {(projects?.length ?? 0) > 1 && (
              <label className="switcher">
                <span className="sr-only">تبديل المشروع</span>
                <select
                  value={id}
                  onChange={(e) => {
                    window.location.hash = `#/projects/${e.target.value}`
                  }}
                >
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
            {isStaff && (
              <button className="btn btn-ghost btn-icon" onClick={() => setDialog('share')}>
                <Link2 size={18} aria-hidden="true" />
                مشاركة مع العميل
              </button>
            )}
            {canEdit && (
              <>
                <button className="btn btn-ghost btn-icon" onClick={() => setDialog('edit')}>
                  <Pencil size={18} aria-hidden="true" />
                  تعديل
                </button>
                <button className="btn btn-icon" onClick={() => setDialog('entry')}>
                  <Plus size={18} aria-hidden="true" />
                  قيد جديد
                </button>
              </>
            )}
          </>
        }
      />

      <Stats
        items={[
          { label: 'الميزانية', value: project.budget },
          { label: 'الوارد', value: project.income, tone: 'ok' },
          { label: 'المصروف', value: project.expenses, tone: 'err' },
          { label: 'الرصيد', value: balance, tone: balance >= 0 ? 'ok' : 'err' },
        ]}
      />

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

      {entries && <EntryList entries={entries} canEdit={canEdit} onEdit={setEditing} onRestored={reload} />}

      {dialog === 'entry' && (
        <EntryDialog projectId={id} projectName={project.name} onClose={() => setDialog(null)} onSaved={reload} />
      )}
      {editing && (
        <EntryDialog
          projectId={id}
          projectName={project.name}
          projects={projects}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
      {dialog === 'share' && <ShareDialog projectId={id} projectName={project.name} onClose={() => setDialog(null)} />}
      {dialog === 'edit' && <ProjectDialog project={project} onClose={() => setDialog(null)} onSaved={reload} />}
    </div>
  )
}
