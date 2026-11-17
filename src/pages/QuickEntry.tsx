import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import AdvancePaymentForm from '../components/AdvancePaymentForm'
import EntryDialog from '../components/EntryDialog'
import { Pencil } from 'lucide-react'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/format'
import { entryTitle, isMoneyIn, signedAmount } from '../lib/entryKind'
import { fetchSummaries, pickableProjects, type ProjectSummary } from '../lib/projects'
import { fetchMyEntries, type MyEntry } from '../lib/entries'
import { useAsync } from '../lib/useAsync'

const STATUS: Record<string, string> = {
  pending: 'مستنّي موافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  deleted: 'محذوف',
}

/** Owner only: pick the project and enter an entry from one page, without opening each project. */
export default function QuickEntry() {
  const { profile } = useAuth()
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const uid = profile?.id
  const fetchMine = useCallback(() => fetchMyEntries(uid ?? ''), [uid])
  const mine = useAsync<MyEntry[]>(fetchMine)
  const [tab, setTab] = useState<'new' | 'mine' | 'advance'>('new')
  const [editing, setEditing] = useState<MyEntry | null>(null)
  const active = pickableProjects(projects.data ?? [])

  return (
    <div className="page-stack quick-page">
      <PageHead title="تسجيل قيد سريع" note="اختار المشروع وسجّل القيد من هنا. القيد بيستنّى موافقتك قبل ما يتحسب." />
      <div className="qe-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'new'}
          className={tab === 'new' ? 'on' : ''}
          onClick={() => setTab('new')}
        >
          قيد جديد
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'mine'}
          className={tab === 'mine' ? 'on' : ''}
          onClick={() => setTab('mine')}
        >
          آخر قيودك
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'advance'}
          className={tab === 'advance' ? 'on' : ''}
          onClick={() => setTab('advance')}
        >
          دفعة عهدة
        </button>
      </div>
      {projects.failed && <p className="msg msg-error">مقدرناش نحمّل المشاريع، جرّب تاني</p>}
      {tab === 'new' && projects.data && active.length === 0 && <div className="card empty">مفيش مشاريع شغّالة.</div>}
      {tab === 'new' && active.length > 0 && (
        <EntryDialog
          inline
          projectId=""
          projectName=""
          projects={active}
          onClose={() => undefined}
          onSaved={mine.reload}
        />
      )}

      {tab === 'advance' && <AdvancePaymentForm />}

      {tab === 'mine' && mine.data && mine.data.length === 0 && <div className="card empty">لسه ما سجلتش قيود.</div>}
      {tab === 'mine' && mine.data && mine.data.length > 0 && (
        <section className="panel">
          <div className="panel-head">
            <h2>آخر قيودك</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th className="sm-hide">التاريخ</th>
                  <th className="sm-hide">المشروع</th>
                  <th>البند</th>
                  <th>المبلغ</th>
                  <th className="sm-hide">الحالة</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mine.data.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">
                      #{e.seq}
                      <span className="sub">{dateText(e.entry_date)}</span>
                    </td>
                    <td className="num muted sm-hide">{dateText(e.entry_date)}</td>
                    <td className="sm-hide">{e.project?.name}</td>
                    <td>
                      {entryTitle(e)}
                      {e.project?.name && <span className="sub-line">{e.project?.name}</span>}
                      <span className="sub">
                        {[e.project?.name, STATUS[e.status] ?? e.status].filter(Boolean).join(' · ')}
                      </span>
                    </td>
                    <td className={`num strong ${isMoneyIn(e) ? 'tone-text-ok' : 'tone-text-err'}`}>
                      {signedAmount(e).sign}
                      {money(signedAmount(e).value)}
                    </td>
                    <td className="muted sm-hide">{STATUS[e.status] ?? e.status}</td>
                    <td>
                      {e.status === 'pending' && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`تعديل القيد ${e.seq}`}
                          onClick={() => setEditing(e)}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <EntryDialog
          projectId={editing.project_id ?? ''}
          projectName={editing.project?.name ?? ''}
          projects={pickableProjects(projects.data ?? [], editing.project_id)}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={mine.reload}
        />
      )}
    </div>
  )
}
