import { useCallback, useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Check, Pencil, X } from 'lucide-react'
import Segmented from '../../components/Segmented'
import {
  NO_FILTER,
  decide,
  fetchByStatus,
  fetchInstallmentsByStatus,
  filterEntries,
  isFiltering,
  type ApprovalFilter,
  type PendingEntry,
  type PendingInstallment,
} from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { dateText, money, todayISO } from '../../lib/format'
import InstallmentApprovals from './InstallmentApprovals'
import ApprovalsReport from './ApprovalsReport'
import DeletedList from './DeletedList'
import { useAuth } from '../../auth/AuthProvider'
import { useAsync } from '../../lib/useAsync'
import InvoiceLink from '../../components/InvoiceLink'
import EntryHistory from '../../components/EntryHistory'
import EntryDialog from '../../components/EntryDialog'

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
  const names = [...new Set(all.map((r) => r.creator?.full_name).filter((n): n is string => Boolean(n)))]
  const banks = [...new Set(all.map((r) => r.bank?.name).filter((n): n is string => Boolean(n)))]
  const setF = (patch: Partial<ApprovalFilter>) => setFilter((f) => ({ ...f, ...patch }))
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

      {!other && all.length > 0 && (
        <section className="card appr-filters" aria-label="فلتر القيود">
          <label className="field">
            كلمة في البيان
            <input value={filter.text} onChange={(e) => setF({ text: e.target.value })} placeholder="مثلًا: نقاشة" />
          </label>
          <label className="field">
            سجّله
            <select value={filter.who} onChange={(e) => setF({ who: e.target.value })}>
              <option value="">الكل</option>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            البنك
            <select value={filter.bank} onChange={(e) => setF({ bank: e.target.value })}>
              <option value="">الكل</option>
              {banks.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            يوم القيد
            <input type="date" value={filter.day} onChange={(e) => setF({ day: e.target.value })} />
          </label>
          <label className="field">
            المبلغ من
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={filter.min}
              onChange={(e) => setF({ min: e.target.value })}
            />
          </label>
          <label className="field">
            المبلغ إلى
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={filter.max}
              onChange={(e) => setF({ max: e.target.value })}
            />
          </label>
          {filtering && (
            <button type="button" className="btn btn-ghost appr-filters-clear" onClick={() => setFilter(NO_FILTER)}>
              مسح الفلتر
            </button>
          )}
        </section>
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
            <article className={`appr-card${picked.has(e.id) ? ' is-picked' : ''}`} key={e.id}>
              <label className="appr-pick">
                <input
                  type="checkbox"
                  checked={picked.has(e.id)}
                  onChange={() => toggle(e.id)}
                  aria-label={`تحديد القيد ${e.seq}`}
                />
              </label>
              <div className="appr-main">
                <div className="appr-tags">
                  <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                    <span className="dot" />
                    {e.kind === 'income' ? 'وارد' : 'مصروف'}
                  </span>
                  {e.advance_id && <span className="chip chip-neutral">من عهدة</span>}
                  <InvoiceLink entry={e} />
                  <span className="muted small">
                    قيد #{e.seq} · {dateText(e.entry_date)}
                  </span>
                </div>
                <h2 className="appr-title">
                  {e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`}
                  <span className="appr-project">{e.project?.name}</span>
                </h2>
                <div className="appr-line">
                  <dl className="appr-meta">
                    {e.contractor && (
                      <div>
                        <dt>المقاول</dt>
                        <dd>{e.contractor.name}</dd>
                      </div>
                    )}
                    {e.bank && (
                      <div>
                        <dt>البنك</dt>
                        <dd>{e.bank.name}</dd>
                      </div>
                    )}
                    {e.edit_reason && (
                      <div>
                        <dt>سبب التعديل</dt>
                        <dd>{e.edit_reason}</dd>
                      </div>
                    )}
                    {e.reject_reason && (
                      <div>
                        <dt>سبب الرفض</dt>
                        <dd className="tone-text-err">{e.reject_reason}</dd>
                      </div>
                    )}
                    {e.notes && (
                      <div>
                        <dt>ملاحظات</dt>
                        <dd>{e.notes}</dd>
                      </div>
                    )}
                    <div>
                      <dt>سجّله</dt>
                      <dd>{e.creator?.full_name ?? '—'}</dd>
                    </div>
                  </dl>
                  {e.edit_reason && <EntryHistory entryId={e.id} />}
                </div>
              </div>
              <div className="appr-side">
                <div className={`appr-amount ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>
                  {e.kind === 'income' ? '+' : '−'}
                  {money(e.amount)}
                  <small>ج.م</small>
                </div>
                <div className="appr-actions">
                  <button
                    className="btn btn-icon"
                    disabled={busy}
                    onClick={() => void act([e], 'approved')}
                    aria-label={`موافقة على القيد ${e.seq}`}
                  >
                    <Check size={17} aria-hidden="true" />
                    موافقة
                  </button>
                  <button
                    className="btn btn-ghost btn-icon"
                    disabled={busy}
                    onClick={() => setEditing(e)}
                    aria-label={`تعديل القيد ${e.seq}`}
                  >
                    <Pencil size={17} aria-hidden="true" />
                    تعديل
                  </button>
                  {tab === 'pending' && (
                    <button
                      className="btn btn-ghost btn-icon"
                      disabled={busy}
                      onClick={() => {
                        setRejecting(e.id)
                        setReason('')
                      }}
                      aria-label={`رفض القيد ${e.seq}`}
                    >
                      <X size={17} aria-hidden="true" />
                      رفض
                    </button>
                  )}
                </div>
                {rejecting === e.id && (
                  <form
                    className="appr-reject"
                    onSubmit={(ev) => {
                      ev.preventDefault()
                      if (reason.trim().length >= 2) void act([e], 'rejected', reason)
                    }}
                  >
                    <input
                      value={reason}
                      onChange={(ev) => setReason(ev.target.value)}
                      placeholder="سبب الرفض (هيظهر للي سجّل القيد)"
                      aria-label={`سبب رفض القيد ${e.seq}`}
                      autoFocus
                      required
                    />
                    <button className="btn btn-danger" disabled={busy || reason.trim().length < 2}>
                      تأكيد الرفض
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setRejecting(null)}>
                      إلغاء
                    </button>
                  </form>
                )}
              </div>
            </article>
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
