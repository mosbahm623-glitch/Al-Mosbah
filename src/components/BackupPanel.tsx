import { useCallback, useState } from 'react'
import { DatabaseBackup } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { downloadBackup, lastBackup } from '../lib/backup'
import { useAsync } from '../lib/useAsync'

const when = (iso: string) => new Date(iso).toLocaleDateString('ar-EG', { dateStyle: 'long' })

/** Admin only. The free plan has no automatic database backups, so this saves a full copy and warns when it has been a week. */
export default function BackupPanel() {
  const { profile, isStaff } = useAuth()
  const last = useAsync<{ at: string | null; stale: boolean }>(useCallback(async () => ({ data: await lastBackup(), error: null }), []))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!isStaff || !last.data) return null

  async function run() {
    if (!profile) return
    setBusy(true)
    setError(null)
    const ok = await downloadBackup(profile.id)
    setBusy(false)
    if (!ok) setError('النسخة الاحتياطية ما اكتملتش، جرّب تاني')
    last.reload()
  }

  const { at, stale } = last.data
  return (
    <section className={`panel backup ${stale ? 'backup-stale' : ''}`}>
      <div className="panel-head">
        <h2>النسخة الاحتياطية</h2>
        <span className={`chip ${stale ? 'chip-err' : 'chip-ok'}`}>{at ? (stale ? 'قديمة' : 'حديثة') : 'ما اتعملتش'}</span>
      </div>
      <p className="muted small">
        {at ? `آخر نسخة: ${when(at)}.` : 'لسه ما اتعملتش أي نسخة.'} الباقة المجانية مفيهاش نسخ تلقائية، نزّل نسخة كل أسبوع واحفظها في مكان تاني.
      </p>
      {error && <p className="msg msg-error">{error}</p>}
      <button className="btn btn-icon" onClick={() => void run()} disabled={busy}>
        <DatabaseBackup size={18} aria-hidden="true" />
        {busy ? 'جارٍ التجهيز...' : 'تنزيل نسخة احتياطية'}
      </button>
    </section>
  )
}
