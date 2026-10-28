import { useCallback, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import EntryDialog from '../components/EntryDialog'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/format'
import { ENTRY_STATUS_LABEL as STATUS } from '../lib/labels'
import { fetchSummaries, type ProjectSummary } from '../lib/projects'
import { fetchMyEntries, type MyEntry } from '../lib/entries'
import { useAsync } from '../lib/useAsync'


/** Owner only: pick the project and enter an entry from one page, without opening each project. */
export default function QuickEntry() {
  const { profile } = useAuth()
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const uid = profile?.id
  const fetchMine = useCallback(() => fetchMyEntries(uid ?? ''), [uid])
  const mine = useAsync<MyEntry[]>(fetchMine)
  const [tab, setTab] = useState<'new' | 'mine'>('new')
  const active = (projects.data ?? []).filter((p) => p.status === 'active')

  return (
    <div className="page-stack">
      <PageHead title="تسجيل قيد سريع" note="اختار المشروع وسجّل القيد من هنا. القيد بيستنّى موافقتك قبل ما يتحسب." />
      <div className="qe-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'new'} className={tab === 'new' ? 'on' : ''} onClick={() => setTab('new')}>قيد جديد</button>
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>آخر قيودك</button>
      </div>
      {projects.failed && <p className="msg msg-error">مقدرناش نحمّل المشاريع، جرّب تاني</p>}
      {tab === 'new' && projects.data && active.length === 0 && <div className="card empty">مفيش مشاريع شغّالة.</div>}
      {tab === 'new' && active.length > 0 && <EntryDialog inline projectId="" projectName="" projects={active} onClose={() => undefined} onSaved={mine.reload} />}

      {tab === 'mine' && mine.data && mine.data.length === 0 && <div className="card empty">لسه ما سجلتش قيود.</div>}
      {tab === 'mine' && mine.data && mine.data.length > 0 && (
        <section className="panel">
          <div className="panel-head"><h2>آخر قيودك</h2></div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>المشروع</th><th>البند</th><th>المبلغ</th><th>الحالة</th></tr></thead>
              <tbody>
                {mine.data.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">{dateText(e.entry_date)}</td>
                    <td>{e.project?.name}</td>
                    <td>{e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</td>
                    <td className="muted">{STATUS[e.status] ?? e.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
