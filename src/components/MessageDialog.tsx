import { useCallback, useState, type FormEvent } from 'react'
import Dialog from './Dialog'
import { useAuth } from '../auth/AuthProvider'
import { MESSAGE_BODY_MAX, MESSAGE_TITLE_MAX, sendMessage } from '../lib/messages'
import { fetchUsers, type UserRow } from '../lib/users'
import { useAsync } from '../lib/useAsync'

const ROLE_TEXT: Record<UserRow['role'], string> = { admin: 'أدمن', owner: 'مالك', user: 'مستخدم' }
const GROUPS = [
  { id: 'all', label: 'الكل' },
  { id: 'owner', label: 'المالك' },
  { id: 'user', label: 'المستخدمين' },
] as const

/** The admin writes a message and picks who gets it: everyone, the owners, the users, or named people. */
export default function MessageDialog({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth()
  const users = useAsync<UserRow[]>(useCallback(() => fetchUsers(), []))
  const [picked, setPicked] = useState<string[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<number | null>(null)
  const [sending, setSending] = useState(false)

  // the admin who writes is not a recipient of the group buttons (he can still tick himself)
  const people = (users.data ?? []).filter((u) => u.is_active)
  const inGroup = (group: (typeof GROUPS)[number]['id']) =>
    people.filter((u) => u.id !== profile?.id && (group === 'all' || u.role === group)).map((u) => u.id)

  function toggleGroup(group: (typeof GROUPS)[number]['id']) {
    const ids = inGroup(group)
    const all = ids.length > 0 && ids.every((id) => picked.includes(id))
    setPicked((now) => (all ? now.filter((id) => !ids.includes(id)) : [...new Set([...now, ...ids])]))
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (picked.length === 0) return setError('اختار حد يستلم الرسالة')
    setSending(true)
    setError(null)
    const sent = await sendMessage(picked, title, body)
    setSending(false)
    if (sent === null) return setError('الرسالة ما اتبعتتش، جرّب تاني')
    setSentTo(sent)
  }

  return (
    <Dialog title="إرسال رسالة" onClose={onClose}>
      {sentTo !== null ? (
        <div className="dialog-form">
          <p className="msg msg-ok" role="status">
            الرسالة اتبعتت لـ {sentTo} {sentTo === 1 ? 'مستخدم' : 'مستخدمين'}، وهتوصلهم كإشعار على التليفون.
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
            هتتبعت لمين
            <div className="add-row">
              {GROUPS.map((g) => {
                const ids = inGroup(g.id)
                const on = ids.length > 0 && ids.every((id) => picked.includes(id))
                return (
                  <button
                    key={g.id}
                    type="button"
                    className={on ? 'btn' : 'btn btn-ghost'}
                    aria-pressed={on}
                    disabled={ids.length === 0}
                    onClick={() => toggleGroup(g.id)}
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
            {users.failed && <span className="msg msg-error">مقدرناش نحمّل المستخدمين</span>}
            {users.loading && !users.data && <span className="muted small">جارٍ التحميل...</span>}
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
                </label>
              ))}
            </div>
          </div>
          <label className="field">
            العنوان
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={MESSAGE_TITLE_MAX}
              placeholder="مثلًا: تنبيه مهم"
              required
            />
          </label>
          <label className="field">
            الرسالة (اختياري)
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={MESSAGE_BODY_MAX} rows={4} />
          </label>
          {error && <p className="msg msg-error">{error}</p>}
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
