import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import PageHead from '../../components/PageHead'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries, type ProjectSummary } from '../../lib/projects'
import { fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances'

export default function Reports() {
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const [projectId, setProjectId] = useState('')
  const [advanceId, setAdvanceId] = useState('')

  const all = projects.data
  const pickedProject = projectId || all?.[0]?.id || ''
  const pickedAdvance = advanceId || advances.data?.[0]?.id || ''

  return (
    <div className="page-stack">
      <PageHead title="التقارير والتصدير" />

      {(projects.failed || advances.failed) && <p className="msg msg-error">مقدرناش نحمّل البيانات، جرّب تاني</p>}
      {projects.loading && !all && <p className="muted">جارٍ التحميل...</p>}

      <section className="panel">
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
        <section className="panel">
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
    </div>
  )
}
