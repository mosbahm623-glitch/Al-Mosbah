import { useCallback, useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Check } from 'lucide-react'
import Segmented from '../../components/Segmented'
import {
  NO_FILTER,
  decide,
  fetchByStatus,
  fetchInstallmentsByStatus,
  filterEntries,
  isFiltering,
  summarize,
  type ApprovalFilter,
  type PendingEntry,
  type PendingInstallment,
} from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { money, todayISO } from '../../lib/format'
import ApprovalFilters from './ApprovalFilters'
import EntryApprovalCard from './EntryApprovalCard'
import InstallmentApprovals from './InstallmentApprovals'
import ApprovalsReport from './ApprovalsReport'
import DeletedList from './DeletedList'
import { useAuth } from '../../auth/AuthProvider'
import { useAsync } from '../../lib/useAsync'
import EntryDialog from '../../components/EntryDialog'
import { enteredByOf } from '../../lib/enteredBy'

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
  const payments = useAsync<PendingInstallment[]>(
    useCallback(
      () =>
        tab === 'decided' || tab === 'deleted'
          ? Promise.resolve({ data: [] as PendingInstallment[], error: null })
          : fetchInstallmentsByStatus(tab),
      [tab],
    ),
  )
  const paymentRows = payments.data ?? []
  const [day, setDay] = useState(todayISO)
  const [busy, setBusy] = useState(false)
  // the entry being rejected (its reason is typed first; the user sees the reason next to the entry)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  // the entry being edited before a decision (the edit asks for a reason and stays in the entry history)
  const [editing, setEditing] = useState<PendingEntry | null>(null)
  const all = useMemo(() => list.data ?? [], [list.data])
  const [filter, setFilter] = useState<ApprovalFilter>(NO_FILTER)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const rows = useMemo(() => filterEntries(all, filter), [all, filter])
  const filtering = isFiltering(filter)
  // only what is on screen can be chosen: an entry hidden by a filter is never approved by mistake
  const chosen = rows.filter((r) => picked.has(r.id))
  const names = [...new Set(all.map(enteredByOf).filter((n): n is string => Boolean(n)))]
  const projects = [...new Set(all.map((r) => r.project?.name).filter((n): n is string => Boolean(n)))].sort((a, b) => a.localeCompare(b, 'ar'))
  const stats = useMemo(() => summarize(all), [all])
  const banks = [...new Set(all.map((r) => r.bank?.name).filter((n): n is string => Boolean(n)))]
  const toggle = (id: string) =>
    setPicked((s) => {
      const next = new Set(s)
      if (!next.delete(id)) next.add(id)
      return next
    })

  async function act(items: PendingEntry[], status: 'approved' | 'rejected', why?: string) {
    setBusy(true)
    setError(null)
    const r = await decide(
      items.map((i) => ({ id: i.id, rev: i.rev })),
      status,
      why,
    )
    setBusy(false)
    setPicked(new Set())
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
          !other &&
          (chosen.length > 0 || (tab === 'pending' && rows.length > 1)) && (
            <button
              className="btn btn-icon"
              disabled={busy}
              onClick={() => void act(chosen.length ? chosen : rows, 'approved')}
            >
              <Check size={18} aria-hidden="true" />
              {chosen.length
                ? `موافقة على المحدد (${chosen.length})`
                : filtering
                  ? `موافقة على المعروض (${rows.length})`
                  : `موافقة على الكل (${rows.length})`}
            </button>
          )
        }
      />

      <div className="toolbar">
        <Segmented
          label="الحالة"
          value={tab}
          options={tabs}
          onChange={(t) => {
            setTab(t)
            setPicked(new Set())
          }}
        />
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
          <span className="toolbar-note muted small">
            {filtering ? `${rows.length} من ${all.length}` : rows.length} قيد
          </span>
        )}
      </div>

      {tab === 'deleted' && <DeletedList />}
      {tab === 'decided' && <ApprovalsReport key={day} day={day} />}

      {error && <p className="msg msg-error">{error}</p>}
      {!other && list.failed && <p className="msg msg-error">مقدرناش نحمّل الموافقات، جرّب تاني</p>}
      {!other && list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {!other && list.data && payments.data && all.length === 0 && paymentRows.length === 0 && (
        <div className="card empty">{tab === 'pending' ? 'مفيش حاجة مستنية موافقة.' : 'مفيش قيود مرفوضة.'}</div>
      )}

      {!other && <InstallmentApprovals rows={paymentRows} onChanged={payments.reload} />}

      {tab === 'pending' && all.length > 0 && (
        <section className="appr-stats" aria-label="ملخص الموافقات">
          <div className="appr-stat is-main">
            <small>مستنية الموافقة</small>
            <b>{stats.count} قيد</b>
          </div>
          <div className="appr-stat">
            <small>إجمالي المبالغ</small>
            <b>{money(stats.total)} ج.م</b>
          </div>
          <div className="appr-stat">
            <small>من العهد</small>
            <b>
              {stats.advCount} قيد · {money(stats.advTotal)}
            </b>
          </div>
          <div className="appr-stat">
            <small>من البنك</small>
            <b>
              {stats.bankCount} قيد · {money(stats.bankTotal)}
            </b>
          </div>
        </section>
      )}

      {!other && all.length > 0 && (
        <ApprovalFilters filter={filter} onChange={setFilter} names={names} banks={banks} projects={projects} />
      )}

      {!other && all.length > 0 && rows.length === 0 && <div className="card empty">مفيش قيود بالفلتر ده.</div>}

      {!other && rows.length > 0 && (
        <label className="check appr-pick-all">
          <input
            type="checkbox"
            checked={chosen.length === rows.length}
            onChange={(e) => setPicked(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
          />
          تحديد كل المعروض ({rows.length})
        </label>
      )}

      {rows.length > 0 && (
        <div className="appr-list">
          {rows.map((e) => (
            <EntryApprovalCard
              key={e.id}
              entry={e}
              picked={picked.has(e.id)}
              busy={busy}
              canReject={tab === 'pending'}
              rejecting={rejecting === e.id}
              reason={reason}
              onToggle={() => toggle(e.id)}
              onApprove={() => void act([e], 'approved')}
              onEdit={() => setEditing(e)}
              onStartReject={() => {
                setRejecting(e.id)
                setReason('')
              }}
              onCancelReject={() => setRejecting(null)}
              onReason={setReason}
              onConfirmReject={() => void act([e], 'rejected', reason)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EntryDialog
          projectId={editing.project_id}
          projectName={editing.project?.name ?? ''}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            list.reload()
            notifyApprovalsChanged()
          }}
        />
      )}
    </div>
  )
}
