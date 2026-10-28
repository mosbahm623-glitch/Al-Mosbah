import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import Segmented from '../../components/Segmented'
import { todayISO } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries, type ProjectSummary } from '../../lib/projects'
import { fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances'
import ProjectReport from '../projects/ProjectReport'
import AdvanceReport from '../advances/AdvanceReport'
import Journal from './Journal'

type ReportType = 'journal' | 'project' | 'advance'

const TYPES: readonly { value: ReportType; label: string }[] = [
  { value: 'journal', label: 'اليومية' },
  { value: 'project', label: 'مشروع' },
  { value: 'advance', label: 'عهدة' },
]

export default function Reports() {
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const [type, setType] = useState<ReportType>('journal')
  const [day, setDay] = useState(todayISO)
  const [projectId, setProjectId] = useState('')
  const [advanceId, setAdvanceId] = useState('')
  const [withContractor, setWithContractor] = useState(true)
  const [withBank, setWithBank] = useState(true)
  const [withNotes, setWithNotes] = useState(true)
  // nothing is drawn until "عرض التقرير" is pressed; changing any choice hides it again
  const [shown, setShown] = useState<{ key: string; n: number } | null>(null)

  const pickedProject = projectId || projects.data?.[0]?.id || ''
  const pickedAdvance = advanceId || advances.data?.[0]?.id || ''
  const target = type === 'journal' ? day : type === 'project' ? pickedProject : pickedAdvance
  const key = useMemo(
    () => [type, target, withContractor, type === 'advance' ? '' : withBank, withNotes].join('|'),
    [type, target, withContractor, withBank, withNotes],
  )
  const visible = shown?.key === key && Boolean(target)
  const cols = { withContractor, withBank, withNotes }

  return (
    <div className="page-stack">
      <div className="no-print">
        <PageHead title="التقارير والتصدير" />
      </div>
      {(projects.failed || advances.failed) && <p className="msg msg-error no-print">مقدرناش نحمّل البيانات، جرّب تاني</p>}

      <div className="reports-layout">
        <section className="panel ctl no-print" aria-label="خيارات التقرير">
          <div className="field">
            نوع التقرير
            <Segmented label="نوع التقرير" value={type} options={TYPES} onChange={setType} />
          </div>

          {type === 'journal' && (
            <label className="field">
              التاريخ
              <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} />
            </label>
          )}
          {type === 'project' && (
            <label className="field">
              المشروع
              <select value={pickedProject} onChange={(e) => setProjectId(e.target.value)} disabled={!projects.data?.length}>
                {!projects.data?.length && <option value="">{projects.loading ? 'جارٍ التحميل...' : 'مفيش مشاريع'}</option>}
                {projects.data?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {type === 'advance' && (
            <label className="field">
              العهدة
              <select value={pickedAdvance} onChange={(e) => setAdvanceId(e.target.value)} disabled={!advances.data?.length}>
                {!advances.data?.length && <option value="">{advances.loading ? 'جارٍ التحميل...' : 'مفيش عهد'}</option>}
                {advances.data?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.holder_name}
                    {a.status === 'closed' ? ' (مقفولة)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          <fieldset className="cols">
            <legend>أعمدة التقرير</legend>
            <label className="check">
              <input type="checkbox" checked={withContractor} onChange={(e) => setWithContractor(e.target.checked)} />
              المقاول
            </label>
            {type !== 'advance' && (
              <label className="check">
                <input type="checkbox" checked={withBank} onChange={(e) => setWithBank(e.target.checked)} />
                البنك
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />
              الملاحظات
            </label>
          </fieldset>

          <button className="btn btn-primary" disabled={!target} onClick={() => setShown({ key, n: (shown?.n ?? 0) + 1 })}>
            عرض التقرير
          </button>
        </section>

        <div className="reports-preview">
          {!visible && (
            <div className="card empty no-print">
              <p>اختار نوع التقرير من الجنب واضغط «عرض التقرير».</p>
            </div>
          )}
          {visible && type === 'journal' && <Journal key={shown.n} day={day} {...cols} />}
          {visible && type === 'project' && <ProjectReport key={shown.n} id={pickedProject} embedded={cols} />}
          {visible && type === 'advance' && <AdvanceReport key={shown.n} id={pickedAdvance} embedded={cols} />}
        </div>
      </div>
    </div>
  )
}
