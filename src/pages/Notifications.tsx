import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, BellRing, CheckCheck, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import PageHead from '../components/PageHead'
import { clearAll, fetchNotices, markAllRead, markRead } from '../lib/notifications'
import { disablePush, enablePush, pushState, type PushState } from '../lib/push'
import { notifyDataChanged } from '../lib/events'
import { useAsync } from '../lib/useAsync'

type InstallEvent = Event & { prompt: () => Promise<void> }
const isIphone = /iphone|ipad|ipod/i.test(navigator.userAgent)
const isInstalled = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Phones deliver notifications best (iPhone: only) when the app is on the home screen. */
function InstallHint() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallEvent)
    }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  if (isInstalled()) return null
  if (isIphone)
    return <p className="muted small">على الآيفون: افتح الموقع من Safari، اضغط زرار المشاركة (المربع والسهم)، واختار "إضافة إلى الشاشة الرئيسية"، وافتح التطبيق من الأيقونة وبعدها فعّل الإشعارات.</p>
  if (prompt)
    return (
      <button className="btn btn-ghost btn-icon" onClick={() => void prompt.prompt()}>
        تثبيت التطبيق على الموبايل
      </button>
    )
  return null
}

const when = (iso: string) => new Date(iso).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })

export default function Notifications() {
  const { profile } = useAuth()
  const list = useAsync(useCallback(() => fetchNotices(), []))
  const [push, setPush] = useState<PushState>('off')
  const [busy, setBusy] = useState(false)
  const rows = list.data ?? []
  const unread = rows.filter((n) => !n.read_at).length

  useEffect(() => {
    void pushState().then(setPush)
  }, [])

  async function run(job: () => PromiseLike<unknown>) {
    setBusy(true)
    await job()
    setBusy(false)
    notifyDataChanged()
  }

  async function togglePush() {
    if (!profile) return
    setBusy(true)
    setPush(push === 'on' ? await disablePush() : await enablePush(profile.id))
    setBusy(false)
  }

  return (
    <div className="page-stack">
      <PageHead
        title="الإشعارات"
        actions={
          rows.length > 0 && (
            <>
              <button className="btn btn-ghost btn-icon" disabled={busy || unread === 0} onClick={() => void run(markAllRead)}>
                <CheckCheck size={18} aria-hidden="true" />
                تعليم الكل كمقروء
              </button>
              <button className="btn btn-ghost btn-icon" disabled={busy} onClick={() => void run(clearAll)}>
                <Trash2 size={18} aria-hidden="true" />
                مسح الكل
              </button>
            </>
          )
        }
      />

      <section className="panel notice-push">
        <InstallHint />
        {push === 'unsupported' && <p className="muted small">المتصفح ده مش بيدعم إشعارات الموبايل{isIphone ? ' من غير تثبيت التطبيق على الشاشة الرئيسية (iOS 16.4 أو أحدث)' : ''}.</p>}
        {push === 'blocked' && <p className="msg msg-error">الإشعارات متقفولة لموقع المصباح. افتحها من إعدادات المتصفح للموقع وبعدين ارجع هنا.</p>}
        {(push === 'on' || push === 'off') && (
          <>
            <p className="muted small">{push === 'on' ? 'إشعارات الموبايل شغّالة على الجهاز ده.' : 'فعّل إشعارات الموبايل عشان توصلك حتى والتطبيق مقفول.'}</p>
            <button className="btn btn-icon" disabled={busy} onClick={() => void togglePush()}>
              {push === 'on' ? <BellOff size={18} aria-hidden="true" /> : <BellRing size={18} aria-hidden="true" />}
              {push === 'on' ? 'إيقاف إشعارات الموبايل' : 'تفعيل إشعارات الموبايل'}
            </button>
          </>
        )}
      </section>

      {list.failed && <p className="msg msg-error">مقدرناش نحمّل الإشعارات، جرّب تاني</p>}
      {list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {list.data && rows.length === 0 && <div className="card empty">مفيش إشعارات.</div>}

      {rows.length > 0 && (
        <ul className="notice-list">
          {rows.map((n) => (
            <li key={n.id} className={n.read_at ? 'notice' : 'notice notice-new'}>
              <a
                href={n.url ?? '#/'}
                onClick={() => {
                  void markRead(n.id).then(notifyDataChanged)
                }}
              >
                <Bell size={18} aria-hidden="true" />
                <span className="notice-text">
                  <strong>{n.title}</strong>
                  {n.body && <span className="muted small">{n.body}</span>}
                  <span className="muted small">{when(n.created_at)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
