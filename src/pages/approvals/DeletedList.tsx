import { useCallback, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { fetchDeleted, restoreEntry, type DeletedEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

const STATUS: Record<string, string> = { approved: 'معتمد', pending: 'مستنّي', rejected: 'مرفوض' }
const when = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })

/** Admin only: entries that were deleted (hidden everywhere, kept in the record). Each one can be restored. */
export default function DeletedList() {
  const { data, failed, loading, reload } = useAsync<DeletedEntry[]>(useCallback(() => fetchDeleted(), []))
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const rows = data ?? []

  async function restore(id: string) {
    setBusy(id)
    setError(null)
    const ok = await restoreEntry(id)
    setBusy(null)
    if (!ok) setError('ما اتسترجعش، جرّب تاني')
    else notifyApprovalsChanged()
    reload()
  }

  return (
    <>
      {error && <p className="msg msg-error">{error}</p>}
      {failed && <p className="msg msg-error">مقدرناش نحمّل القيود المحذوفة، جرّب تاني</p>}
      {loading && !data && <p className="muted">جارٍ التحميل...</p>}
      {data && rows.length === 0 && <div className="card empty">مفيش قيود محذوفة.</div>}
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
                  <span className="muted small">
                    قيد #{e.seq} · {dateText(e.entry_date)}
                  </span>
                </div>
                <h2 className="appr-title">{e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`}</h2>
                <p className="appr-project">{e.project}</p>
                <dl className="appr-meta">
                  {e.contractor && (
                    <div>
                      <dt>المقاول</dt>
                      <dd>{e.contractor}</dd>
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
                    <dd>{e.created_by_name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>اتمسح بواسطة</dt>
                    <dd>
                      {e.deleted_by_name ?? '—'} · {when(e.deleted_at)}
                    </dd>
                  </div>
                  {e.delete_reason && (
                    <div>
                      <dt>السبب</dt>
                      <dd>{e.delete_reason}</dd>
                    </div>
                  )}
                  <div>
                    <dt>كان</dt>
                    <dd>{STATUS[e.status_before_delete ?? ''] ?? '—'}</dd>
                  </div>
                </dl>
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
                    disabled={busy === e.id}
                    onClick={() => void restore(e.id)}
                    aria-label={`استرجاع القيد ${e.seq}`}
                  >
                    <RotateCcw size={17} aria-hidden="true" />
                    استرجاع
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
