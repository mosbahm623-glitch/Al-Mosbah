import { useCallback, useState } from 'react'
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
      <div className="page-head">
        <div>
          <nav className="crumbs" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <span aria-hidden="true">‹</span>
            <span className="crumb-current">الموافقات</span>
          </nav>
          <h1 className="page-title">الموافقات</h1>
        </div>
        {tab === 'pending' && rows.length > 1 && (
          <button className="btn btn-icon" disabled={busy} onClick={() => void act(rows.map((r) => r.id), 'approved')}>
            <Check size={18} aria-hidden="true" />
            موافقة على الكل ({rows.length})
          </button>
        )}
      </div>

      <div className="toolbar">
        <Segmented label="الحالة" value={tab} options={TABS} onChange={setTab} />
        <span className="toolbar-note muted small">{rows.length} قيد</span>
      </div>

      {error && <p className="msg msg-error">{error}</p>}
      {list.failed && <p className="msg msg-error">مقدرناش نحمّل الموافقات، جرّب تاني</p>}
      {list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {list.data && rows.length === 0 && <div className="card empty">{tab === 'pending' ? 'مفيش حاجة مستنية موافقة.' : 'مفيش قيود مرفوضة.'}</div>}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم القيد</th><th>التاريخ</th><th>المشروع</th><th>النوع</th><th>البيان</th><th>المقاول</th><th>البنك</th><th>المبلغ</th><th>اتسجّل بواسطة</th><th><span className="sr-only">إجراءات</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">{dateText(e.entry_date)}</td>
                    <td>{e.project?.name}</td>
                    <td>
                      <span className={`chip ${e.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        <span className="dot" />
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                      {e.advance_id && <> <span className="chip chip-neutral">من عهدة</span></>}
                    </td>
                    <td>{e.kind === 'income' ? e.category : `${e.category} · ${e.item ?? ''}`}{e.notes ? <span className="muted small"> — {e.notes}</span> : null}</td>
                    <td className="muted">{e.contractor?.name}</td>
                    <td className="muted">{e.bank?.name}</td>
                    <td className={`num strong ${e.kind === 'income' ? 'tone-text-ok' : 'tone-text-err'}`}>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</td>
                    <td className="muted">{e.creator?.full_name ?? '—'}</td>
                    <td>
                      <div className="head-actions">
                        <button className="btn btn-icon" disabled={busy} onClick={() => void act([e.id], 'approved')} aria-label={`موافقة على القيد ${e.seq}`}>
                          <Check size={16} aria-hidden="true" />
                          موافقة
                        </button>
                        {tab === 'pending' && (
                          <button className="btn btn-ghost btn-icon" disabled={busy} onClick={() => void act([e.id], 'rejected')} aria-label={`رفض القيد ${e.seq}`}>
                            <X size={16} aria-hidden="true" />
                            رفض
                          </button>
                        )}
                      </div>
                    </td>
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
