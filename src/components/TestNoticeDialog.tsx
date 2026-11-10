import { useCallback, useState, type FormEvent } from 'react'
import { Smartphone } from 'lucide-react'
import Dialog from './Dialog'
import { fetchPushDevices, sendTestNotification } from '../lib/testNotice'
import { fetchUsers, type UserRow } from '../lib/users'
import { useAsync } from '../lib/useAsync'

const ROLE_TEXT: Record<UserRow['role'], string> = { admin: 'أدمن', owner: 'مالك', user: 'مستخدم' }

/**
 * The admin picks who gets a test notification (everyone or named people) to check that notifications reach them.
 * Each person shows whether a phone is registered: without one the notice arrives inside the app only.
 */
export default function TestNoticeDialog({ onClose }: { onClose: () => void }) {
  const load = useCallback(async () => {
    const [users, devices] = await Promise.all([fetchUsers(), fetchPushDevices()])
    return { data: { users: users.data ?? [], devices }, error: users.error }
  }, [])
  const { data, failed, loading } = useAsync<{ users: UserRow[]; devices: Record<string, number> | null }>(load)
  const [picked, setPicked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  const people = (data?.users ?? []).filter((u) => u.is_active)
  const devices = data?.devices ?? {}
  const everyone = people.length > 0 && people.every((u) => picked.includes(u.id))

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (picked.length === 0) return setError('اختار حد يستلم الإشعار التجريبي')
    setSending(true)
    setError(null)
    const sent = await sendTestNotification(picked)
    setSending(false)
    if (sent === null) return setError('الإشعار التجريبي ما اتبعتش، جرّب تاني')
    setSentTo(sent)
  }

  return (
    <Dialog title="إشعار تجريبي" onClose={onClose}>
      {sentTo !== null ? (
        <div className="dialog-form">
          <p className="msg msg-ok" role="status">
            الإشعار التجريبي اتبعت لـ {sentTo} {sentTo === 1 ? 'مستخدم' : 'مستخدمين'}. بيظهر عندهم فورًا في التطبيق،
            وعلى التليفون لمن فعّل إشعارات الموبايل.
          </p>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onClose}>
              تمام
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="dialog-form">
          <div className="msg-to">
            الإشعار التجريبي هيتبعت لمين
            <div className="add-row">
              <button
                type="button"
                className={everyone ? 'btn' : 'btn btn-ghost'}
                aria-pressed={everyone}
                disabled={people.length === 0}
                onClick={() => setPicked(everyone ? [] : people.map((u) => u.id))}
              >
                الكل
              </button>
            </div>
            {failed && <span className="msg msg-error">مقدرناش نحمّل المستخدمين</span>}
            {loading && !data && <span className="muted small">جارٍ التحميل...</span>}
            {data && data.devices === null && (
              <span className="muted small">مقدرناش نعرف مين مسجّل تليفونه، بس الإرسال شغّال.</span>
            )}
            <div className="msg-to-list">
              {people.map((u) => (
                <label className="check" key={u.id}>
                  <input
                    type="checkbox"
                    checked={picked.includes(u.id)}
                    onChange={(e) =>
                      setPicked((now) => (e.target.checked ? [...now, u.id] : now.filter((id) => id !== u.id)))
                    }
                  />
                  {u.full_name || u.email} <span className="muted small">· {ROLE_TEXT[u.role]}</span>
                  {data?.devices && (
                    <span className={devices[u.id] ? 'device device-on' : 'device'}>
                      <Smartphone size={14} aria-hidden="true" />
                      {devices[u.id] ? 'تليفون مسجّل' : 'مفيش تليفون مسجّل'}
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
          <p className="muted small">
            هيوصلهم إشعار عنوانه «إشعار تجريبي» ومفيش مطلوب منهم حاجة. اللي مسجّل تليفونه بيوصله على التليفون كمان،
            واللي لأ بيوصله جوه التطبيق بس.
          </p>
          {error && (
            <p className="msg msg-error" role="alert">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button className="btn" disabled={sending}>
              {sending ? 'جارٍ الإرسال...' : `إرسال${picked.length ? ` (${picked.length})` : ''}`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              إلغاء
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
