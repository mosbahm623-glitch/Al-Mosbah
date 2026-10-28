import { useCallback, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Check, X } from 'lucide-react'
import Segmented from '../../components/Segmented'
import { decide, fetchByStatus, type PendingEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { dateText, money, todayISO } from '../../lib/format'
import ApprovalsReport from './ApprovalsReport'
import DeletedList from './DeletedList'
import { useAuth } from '../../auth/AuthProvider'
import { useAsync } from '../../lib/useAsync'

const TABS = [
  { value: 'pending', label: 'مستنية الموافقة' },
  { value: 'rejected', label: 'المرفوضة' },
  { value: 'decided', label: 'قرارات اليوم' },
  { value: 'deleted', label: 'المحذوفة' },
] as const

export default function Approvals() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('pending')
  const { isAdmin } = useAuth()
  const tabs = isAdmin ? TABS : TABS.filter((t) => t.value !== 'deleted')
  const other = tab === 'decided' || tab === 'deleted'
  const list = useAsync<PendingEntry[]>(
    useCallback(() => (tab === 'decided' || tab === 'deleted' ? Promise.resolve({ data: [] as PendingEntry[], error: null }) : fetchByStatus(tab)), [tab]),
  )
  const [day, setDay] = useState(todayISO)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = list.data ?? []

  async function act(items: PendingEntry[], status: 'approved' | 'rejected') {
    setBusy(true)
    setError(null)
    const r = await decide(items.map((i) => ({ id: i.id, rev: i.rev })), status)
    setBusy(false)
    if (r.failed) setError('ما اتنفّذش، جرّب تاني')
    else if (r.skipped > 0) setError(`${r.skipped} قيد اتغيّر من حد تاني من وقت ما فتحت الصفحة، اتحدّثت القايمة، راجعه وبعدين وافق`)
    if (r.done > 0) notifyApprovalsChanged()
    list.reload()
  }

  return (
    <div className="page-stack">
      <PageHead
        title="الموافقات"
        actions={
          tab === 'pending' &&
          rows.length > 1 && (
            <button className="btn btn-icon" disabled={busy} onClick={() => void act(rows, 'approved')}>
              <Check size={18} aria-hidden="true" />
              موافقة على الكل ({rows.length})
            </button>
          )
        }
      />

      <div className="toolbar">
        <Segmented label="الحالة" value={tab} options={tabs} onChange={setTab} />
        {tab === 'deleted' ? null : tab === 'decided' ? (
          <label className="field toolbar-note">
            اليوم
            <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
        ) : (
          <span className="toolbar-note muted small">{rows.length} قيد</span>
        )}
      </div>

      {tab === 'deleted' && <DeletedList />}
      {tab === 'decided' && <ApprovalsReport key={day} day={day} />}

      {error && <p className="msg msg-error">{error}</p>}
      {!other && list.failed && <p className="msg msg-error">مقدرناش نحمّل الموافقات، جرّب تاني</p>}
      {!other && list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {!other && list.data && rows.length === 0 && <div className="card empty">{tab === 'pending' ? 'مفيش حاجة مستنية موافقة.' : 'مفيش قيود مرفوضة.'}</div>}

      {rows.length > 0 && (
        <div className="appr-list">
          {rows.map((e) => (
            <article className="appr-card" key={e.id}>
              <div className="appr-main">
                <div className="appr-tags">
                  <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                    <span className="dot" />
                    {e.kind === 'income' ? 'وارد' : 'مصروف'}
                  </span>
                  {e.advance_id && <span className="chip chip-neutral">من عهدة</span>}
                  <span className="muted small">قيد #{e.seq} · {dateText(e.entry_date)}</span>
                </div>
                <h2 className="appr-title">{e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`}</h2>
                <p className="appr-project">{e.project?.name}</p>
                <dl className="appr-meta">
                  {e.contractor && <div><dt>المقاول</dt><dd>{e.contractor.name}</dd></div>}
                  {e.bank && <div><dt>البنك</dt><dd>{e.bank.name}</dd></div>}
                  {e.notes && <div><dt>ملاحظات</dt><dd>{e.notes}</dd></div>}
                  <div><dt>سجّله</dt><dd>{e.creator?.full_name ?? '—'}</dd></div>
                </dl>
              </div>
              <div className="appr-side">
                <div className={`appr-amount ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                  {e.kind === 'income' ? '+' : '−'}
                  {money(e.amount)}
                  <small>ج.م</small>
                </div>
                <div className="appr-actions">
                  <button className="btn btn-icon" disabled={busy} onClick={() => void act([e], 'approved')} aria-label={`موافقة على القيد ${e.seq}`}>
                    <Check size={17} aria-hidden="true" />
                    موافقة
                  </button>
                  {tab === 'pending' && (
                    <button className="btn btn-ghost btn-icon" disabled={busy} onClick={() => void act([e], 'rejected')} aria-label={`رفض القيد ${e.seq}`}>
                      <X size={17} aria-hidden="true" />
                      رفض
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
