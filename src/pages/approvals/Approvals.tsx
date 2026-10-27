import { useCallback, useState } from 'react'
import PageHead from '../../components/PageHead'
import { Check, X } from 'lucide-react'
import Segmented from '../../components/Segmented'
import { decide, fetchByStatus, notifyApprovalsChanged, type PendingEntry } from '../../lib/approvals'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

const TABS = [
  { value: 'pending', label: 'مستنية الموافقة' },
  { value: 'rejected', label: 'المرفوضة' },
] as const

export default function Approvals() {
  const [tab, setTab] = useState<(typeof TABS)[number]['value']>('pending')
  const list = useAsync<PendingEntry[]>(useCallback(() => fetchByStatus(tab), [tab]))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows = list.data ?? []

  async function act(ids: string[], status: 'approved' | 'rejected') {
    setBusy(true)
    setError(null)
    const { error: err } = await decide(ids, status)
    setBusy(false)
    if (err) return setError('ما اتنفّذش، جرّب تاني')
    notifyApprovalsChanged()
    list.reload()
  }

  return (
    <div className="page-stack">
      <PageHead
        title="الموافقات"
        actions={
          tab === 'pending' &&
          rows.length > 1 && (
            <button className="btn btn-icon" disabled={busy} onClick={() => void act(rows.map((r) => r.id), 'approved')}>
              <Check size={18} aria-hidden="true" />
              موافقة على الكل ({rows.length})
            </button>
          )
        }
      />

      <div className="toolbar">
        <Segmented label="الحالة" value={tab} options={TABS} onChange={setTab} />
        <span className="toolbar-note muted small">{rows.length} قيد</span>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {list.failed && <p className="msg msg-error">مقدرناش نحمّل الموافقات، جرّب تاني</p>}
      {list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {list.data && rows.length === 0 && <div className="card empty">{tab === 'pending' ? 'مفيش حاجة مستنية موافقة.' : 'مفيش قيود مرفوضة.'}</div>}

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
                  <button className="btn btn-icon" disabled={busy} onClick={() => void act([e.id], 'approved')} aria-label={`موافقة على القيد ${e.seq}`}>
                    <Check size={17} aria-hidden="true" />
                    موافقة
                  </button>
                  {tab === 'pending' && (
                    <button className="btn btn-ghost btn-icon" disabled={busy} onClick={() => void act([e.id], 'rejected')} aria-label={`رفض القيد ${e.seq}`}>
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
