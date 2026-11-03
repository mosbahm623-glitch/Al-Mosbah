import { useState } from 'react'
import { Check, X } from 'lucide-react'
import StatusChip from '../../components/StatusChip'
import { decideInstallments, type PendingInstallment } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { dateText, money } from '../../lib/format'

type Props = { rows: PendingInstallment[]; onChanged: () => void }

/** Custody payments the owner handed out, waiting for the admin (approve, or reject with a reason). */
export default function InstallmentApprovals({ rows, onChanged }: Props) {
  const [busy, setBusy] = useState(false)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function act(item: PendingInstallment, status: 'approved' | 'rejected', why?: string) {
    setBusy(true)
    setError(null)
    const r = await decideInstallments([{ id: item.id, status: item.status }], status, why)
    setBusy(false)
    setRejecting(null)
    setReason('')
    if (r.failed) setError('ما اتنفّذش، جرّب تاني')
    else if (r.skipped > 0) setError('الدفعة اتغيّرت من حد تاني، اتحدّثت القايمة، راجعها وبعدين وافق')
    if (r.done > 0) notifyApprovalsChanged()
    onChanged()
  }

  if (rows.length === 0) return null
  return (
    <section aria-label="دفعات العهد">
      <h2 className="section-title">دفعات عهد ({rows.length})</h2>
      {error && <p className="msg msg-error">{error}</p>}
      <div className="appr-list">
        {rows.map((p) => (
          <article className="appr-card" key={p.id}>
            <div className="appr-main">
              <div className="appr-tags">
                <span className="chip chip-neutral">دفعة عهدة</span>
                {p.status === 'rejected' && <StatusChip status="rejected" kind="payment" />}
                <span className="muted small">{dateText(p.paid_on)}</span>
              </div>
              <h2 className="appr-title">
                <a href={`#/advances/${p.advance_id}`}>{p.advance?.holder_name ?? 'عهدة'}</a>
              </h2>
              <dl className="appr-meta">
                {p.reject_reason && (
                  <div>
                    <dt>سبب الرفض</dt>
                    <dd className="tone-text-err">{p.reject_reason}</dd>
                  </div>
                )}
                <div>
                  <dt>سجّلها</dt>
                  <dd>{p.creator?.full_name ?? '—'}</dd>
                </div>
              </dl>
            </div>
            <div className="appr-side">
              <div className="appr-amount tone-text-err">
                {money(p.amount)}
                <small>ج.م</small>
              </div>
              <div className="appr-actions">
                <button
                  className="btn btn-icon"
                  disabled={busy}
                  onClick={() => void act(p, 'approved')}
                  aria-label={`موافقة على دفعة ${p.advance?.holder_name ?? ''}`}
                >
                  <Check size={17} aria-hidden="true" />
                  موافقة
                </button>
                {p.status === 'pending' && (
                  <button
                    className="btn btn-ghost btn-icon"
                    disabled={busy}
                    onClick={() => {
                      setRejecting(p.id)
                      setReason('')
                    }}
                    aria-label={`رفض دفعة ${p.advance?.holder_name ?? ''}`}
                  >
                    <X size={17} aria-hidden="true" />
                    رفض
                  </button>
                )}
              </div>
              {rejecting === p.id && (
                <form
                  className="appr-reject"
                  onSubmit={(ev) => {
                    ev.preventDefault()
                    if (reason.trim().length >= 2) void act(p, 'rejected', reason)
                  }}
                >
                  <input
                    value={reason}
                    onChange={(ev) => setReason(ev.target.value)}
                    placeholder="سبب الرفض (هيظهر للي سجّل الدفعة)"
                    aria-label="سبب رفض الدفعة"
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
    </section>
  )
}
