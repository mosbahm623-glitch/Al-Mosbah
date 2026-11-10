import { useCallback, useState } from 'react'
import Dialog from './Dialog'
import { money } from '../lib/format'
import { fetchLowBalanceOverview, sendLowBalanceReminder, type LowBalanceOverview } from '../lib/testNotice'
import { useAsync } from '../lib/useAsync'

/** Shows the projects under the limit and who will be told, and sends the reminder to the owners only after a confirm. */
export default function LowBalanceReminderDialog({ onClose }: { onClose: () => void }) {
  const load = useCallback(async () => {
    const data = await fetchLowBalanceOverview()
    return { data, error: data ? null : true }
  }, [])
  const { data, failed, loading } = useAsync<LowBalanceOverview>(load)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ projects: number; owners: number } | null>(null)

  async function send() {
    setSending(true)
    setError(null)
    const r = await sendLowBalanceReminder()
    setSending(false)
    if (!r) return setError('التذكير ما اتبعتش، جرّب تاني')
    setDone(r)
  }

  const none = data && data.projects.length === 0
  const noOwner = data && data.owners === 0
  return (
    <Dialog title="تذكير المالك بالمشاريع الأقل من 50 ألف" onClose={onClose}>
      <div className="dialog-form">
        {done ? (
          <p className="msg msg-ok" role="status">
            اتبعت تذكير بـ {done.projects} مشروع لـ {done.owners} مالك. بيظهر عنده فورًا في التطبيق وعلى التليفون.
          </p>
        ) : (
          <>
            {loading && !data && <p className="muted">جارٍ التحميل...</p>}
            {failed && !data && <p className="msg msg-error">مقدرناش نحمّل المشاريع، جرّب تاني</p>}
            {none && <p className="muted">مفيش مشروع نشط رصيده أقل من {money(data.limit)}.</p>}
            {data && !none && (
              <>
                <p>
                  {data.projects.length} مشروع نشط رصيده أقل من {money(data.limit)}. هيتبعت تذكير بيهم لـ {data.owners}{' '}
                  مالك.
                </p>
                <ul className="reminder-list">
                  {data.projects.map((p) => (
                    <li key={p.name}>
                      <span>{p.name}</span>
                      <span className="num tone-text-err">{money(p.balance)}</span>
                    </li>
                  ))}
                </ul>
                {noOwner && <p className="msg msg-error">مفيش مالك مفعّل يستلم التذكير.</p>}
              </>
            )}
            {error && (
              <p className="msg msg-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <div className="dialog-actions">
          {!done && data && !none && !noOwner && (
            <button className="btn" disabled={sending} onClick={() => void send()}>
              {sending ? 'جارٍ الإرسال...' : 'إرسال للمالك'}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {done ? 'تمام' : 'إلغاء'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
