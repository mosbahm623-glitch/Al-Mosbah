import { useCallback, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Check } from 'lucide-react'
import Segmented from '../../components/Segmented'
import { decide, fetchByStatus, type PendingEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { money, todayISO } from '../../lib/format'
import ApprovalsReport from './ApprovalsReport'
import ApprovalCard from './ApprovalCard'
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
    useCallback(
      () =>
        tab === 'decided' || tab === 'deleted'
          ? Promise.resolve({ data: [] as PendingEntry[], error: null })
          : fetchByStatus(tab),
      [tab],
    ),
  )
  const [day, setDay] = useState(todayISO)
  const [busy, setBusy] = useState(false)
  // the entry being rejected (its reason is typed first; the user sees the reason next to the entry)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rows = list.data ?? []
  const sum = (kind: 'income' | 'expense') => rows.filter((r) => r.kind === kind).reduce((t, r) => t + r.amount, 0)

  async function act(items: PendingEntry[], status: 'approved' | 'rejected', why?: string) {
    setBusy(true)
    setError(null)
    const r = await decide(
      items.map((i) => ({ id: i.id, rev: i.rev })),
      status,
      why,
    )
    setBusy(false)
    setRejecting(null)
    setReason('')
    if (r.failed) setError('ما اتنفّذش، جرّب تاني')
    else if (r.skipped > 0)
      setError(`${r.skipped} قيد اتغيّر من حد تاني من وقت ما فتحت الصفحة، اتحدّثت القايمة، راجعه وبعدين وافق`)
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
            <input
              type="date"
              value={day}
              max={todayISO()}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
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
      {!other && list.data && rows.length === 0 && (
        <div className="card empty">{tab === 'pending' ? 'مفيش حاجة مستنية موافقة.' : 'مفيش قيود مرفوضة.'}</div>
      )}

      {rows.length > 0 && !other && (
        <section className="stats appr-stats" aria-label="ملخص">
          <div className="stat">
            <span className="muted small">عدد القيود</span>
            <strong>{rows.length}</strong>
          </div>
          <div className="stat">
            <span className="muted small">إجمالي المصروفات</span>
            <strong className="tone-text-err">
              {money(sum('expense'))}
              <small>ج.م</small>
            </strong>
          </div>
          <div className="stat">
            <span className="muted small">إجمالي الوارد</span>
            <strong className="tone-text-ok">
              {money(sum('income'))}
              <small>ج.م</small>
            </strong>
          </div>
        </section>
      )}

      {rows.length > 0 && (
        <div className="appr-list">
          {rows.map((e) => (
            <ApprovalCard
              key={e.id}
              entry={e}
              tab={tab === 'rejected' ? 'rejected' : 'pending'}
              busy={busy}
              rejecting={rejecting === e.id}
              reason={reason}
              onReason={setReason}
              onApprove={() => void act([e], 'approved')}
              onStartReject={() => {
                setRejecting(e.id)
                setReason('')
              }}
              onConfirmReject={() => void act([e], 'rejected', reason)}
              onCancelReject={() => setRejecting(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
