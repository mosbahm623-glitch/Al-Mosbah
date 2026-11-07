import { Check, Pencil, X } from 'lucide-react'
import EntryHistory from '../../components/EntryHistory'
import InvoiceLink from '../../components/InvoiceLink'
import type { PendingEntry } from '../../lib/approvals'
import { dateText, money } from '../../lib/format'

type Props = {
  entry: PendingEntry
  picked: boolean
  busy: boolean
  /** only entries still waiting can be rejected (a rejected one is edited or approved) */
  canReject: boolean
  rejecting: boolean
  reason: string
  onToggle: () => void
  onApprove: () => void
  onEdit: () => void
  onStartReject: () => void
  onCancelReject: () => void
  onReason: (v: string) => void
  onConfirmReject: () => void
}

/** One entry in the approvals list, with its approve / edit / reject actions. */
export default function EntryApprovalCard({
  entry: e,
  picked,
  busy,
  canReject,
  rejecting,
  reason,
  onToggle,
  onApprove,
  onEdit,
  onStartReject,
  onCancelReject,
  onReason,
  onConfirmReject,
}: Props) {
  return (
    <article className={`appr-card${picked ? ' is-picked' : ''}`}>
      <label className="appr-pick">
        <input type="checkbox" checked={picked} onChange={onToggle} aria-label={`تحديد القيد ${e.seq}`} />
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
              <dd>{e.creator?.full_name ?? e.entered_by_name ?? '—'}</dd>
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
          <button className="btn btn-icon" disabled={busy} onClick={onApprove} aria-label={`موافقة على القيد ${e.seq}`}>
            <Check size={17} aria-hidden="true" />
            موافقة
          </button>
          <button
            className="btn btn-ghost btn-icon"
            disabled={busy}
            onClick={onEdit}
            aria-label={`تعديل القيد ${e.seq}`}
          >
            <Pencil size={17} aria-hidden="true" />
            تعديل
          </button>
          {canReject && (
            <button
              className="btn btn-ghost btn-icon"
              disabled={busy}
              onClick={onStartReject}
              aria-label={`رفض القيد ${e.seq}`}
            >
              <X size={17} aria-hidden="true" />
              رفض
            </button>
          )}
        </div>
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
      </div>
    </article>
  )
}
