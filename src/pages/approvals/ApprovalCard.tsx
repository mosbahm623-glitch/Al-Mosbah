import { Ban, Building2, Check, HardHat, Landmark, Pencil, StickyNote, X } from 'lucide-react'
import EntryHistory from '../../components/EntryHistory'
import InvoiceLink from '../../components/InvoiceLink'
import type { PendingEntry } from '../../lib/approvals'
import { dateText, money } from '../../lib/format'

type Props = {
  entry: PendingEntry
  tab: 'pending' | 'rejected'
  busy: boolean
  /** the reason box for rejecting this entry is open */
  rejecting: boolean
  reason: string
  onReason: (value: string) => void
  onApprove: () => void
  onStartReject: () => void
  onConfirmReject: () => void
  onCancelReject: () => void
}

const when = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })

/** One entry waiting for a decision: what it is, who recorded it, why it changed, and the two buttons. */
export default function ApprovalCard({
  entry: e,
  tab,
  busy,
  rejecting,
  reason,
  onReason,
  onApprove,
  onStartReject,
  onConfirmReject,
  onCancelReject,
}: Props) {
  const income = e.kind === 'income'
  const who = e.creator?.full_name ?? '—'
  return (
    <article className={`appr-card ${income ? 'appr-in' : 'appr-out'}`}>
      <header className="appr-head">
        <div className="appr-id">
          <span className={`chip ${income ? 'chip-ok' : 'chip-err'}`}>
            <span className="dot" />
            {income ? 'وارد' : 'مصروف'}
          </span>
          {e.advance_id && <span className="chip chip-neutral">من عهدة</span>}
          <span className="appr-no">قيد #{e.seq}</span>
          <span className="muted small">{dateText(e.entry_date)}</span>
          <InvoiceLink entry={e} />
        </div>
        <div className={`appr-amount ${income ? 'tone-text-ok' : 'tone-text-err'}`}>
          {income ? '+' : '−'}
          {money(e.amount)}
          <small>ج.م</small>
        </div>
      </header>

      <div className="appr-body">
        <h2 className="appr-title">{income ? e.category : `${e.category} · ${e.item ?? ''}`}</h2>
        {e.project?.name && (
          <p className="appr-project">
            <Building2 size={16} aria-hidden="true" />
            {e.project.name}
          </p>
        )}

        {(e.contractor || e.bank || e.notes) && (
          <dl className="appr-facts">
            {e.contractor && (
              <div>
                <dt>
                  <HardHat size={14} aria-hidden="true" />
                  المقاول
                </dt>
                <dd>{e.contractor.name}</dd>
              </div>
            )}
            {e.bank && (
              <div>
                <dt>
                  <Landmark size={14} aria-hidden="true" />
                  البنك
                </dt>
                <dd>{e.bank.name}</dd>
              </div>
            )}
            {e.notes && (
              <div className="appr-wide">
                <dt>
                  <StickyNote size={14} aria-hidden="true" />
                  ملاحظات
                </dt>
                <dd>{e.notes}</dd>
              </div>
            )}
          </dl>
        )}

        {e.edit_reason && (
          <div className="appr-callout appr-callout-edit">
            <Pencil size={16} aria-hidden="true" />
            <div>
              <strong>سبب التعديل</strong>
              <p>{e.edit_reason}</p>
            </div>
          </div>
        )}
        {e.reject_reason && (
          <div className="appr-callout appr-callout-err">
            <Ban size={16} aria-hidden="true" />
            <div>
              <strong>سبب الرفض</strong>
              <p>{e.reject_reason}</p>
            </div>
          </div>
        )}
        {e.edit_reason && <EntryHistory entryId={e.id} />}
      </div>

      <footer className="appr-foot">
        <div className="appr-by">
          <span className="appr-by-avatar" aria-hidden="true">
            {who.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <span className="muted small">سجّله</span> <strong>{who}</strong>
            <span className="appr-by-time muted small">{when(e.created_at)}</span>
          </span>
        </div>
        <div className="appr-actions">
          {tab === 'pending' && (
            <button
              className="btn btn-ghost btn-icon appr-no-btn"
              disabled={busy}
              onClick={onStartReject}
              aria-label={`رفض القيد ${e.seq}`}
            >
              <X size={17} aria-hidden="true" />
              رفض
            </button>
          )}
          <button className="btn btn-icon" disabled={busy} onClick={onApprove} aria-label={`موافقة على القيد ${e.seq}`}>
            <Check size={17} aria-hidden="true" />
            موافقة
          </button>
        </div>
      </footer>

      {rejecting && (
        <form
          className="appr-reject"
          onSubmit={(ev) => {
            ev.preventDefault()
            if (reason.trim().length >= 2) onConfirmReject()
          }}
        >
          <input
            value={reason}
            onChange={(ev) => onReason(ev.target.value)}
            placeholder="سبب الرفض (هيظهر للي سجّل القيد)"
            aria-label={`سبب رفض القيد ${e.seq}`}
            autoFocus
            required
          />
          <button className="btn btn-danger" disabled={busy || reason.trim().length < 2}>
            تأكيد الرفض
          </button>
          <button type="button" className="btn btn-ghost" onClick={onCancelReject}>
            إلغاء
          </button>
        </form>
      )}
    </article>
  )
}
