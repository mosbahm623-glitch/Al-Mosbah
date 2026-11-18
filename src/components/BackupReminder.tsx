import { useCallback, useState } from 'react'
import Dialog from './Dialog'
import { useAuth } from '../auth/AuthProvider'
import { lastBackup } from '../lib/export/backup'
import { useAsync } from '../lib/core/useAsync'

const KEY = 'mosbah-backup-reminder'
const day = (d: Date) => d.toLocaleDateString('en-CA')

function seenToday(): boolean {
  try {
    return localStorage.getItem(KEY) === day(new Date())
  } catch {
    return false
  }
}

/** Admin only: once a day, on the first open, reminds him if no backup was taken today. */
export default function BackupReminder() {
  const { isAdmin } = useAuth()
  const [closed, setClosed] = useState(seenToday)
  const [today] = useState(() => day(new Date()))
  const last = useAsync<{ at: string | null; stale: boolean }>(
    useCallback(async () => ({ data: isAdmin && !closed ? await lastBackup() : null, error: null }), [isAdmin, closed]),
  )
  if (!isAdmin || closed || !last.data) return null
  const { at } = last.data
  if (at && day(new Date(at)) === today) return null

  function close(go: boolean) {
    try {
      localStorage.setItem(KEY, today)
    } catch {
      /* ignore */
    }
    setClosed(true)
    if (go) window.location.hash = '#/backup'
  }

  return (
    <Dialog title="تذكير النسخة الاحتياطية" onClose={() => close(false)}>
      <div className="dialog-form">
        <p>
          {at
            ? `آخر نسخة احتياطية كانت ${new Date(at).toLocaleDateString('ar-EG', { dateStyle: 'long' })}.`
            : 'لسه ما اتعملتش أي نسخة احتياطية.'}{' '}
          لسه ما نزّلتش نسخة النهارده.
        </p>
        <div className="dialog-actions">
          <button className="btn" onClick={() => close(true)}>
            نزّل النسخة دلوقتي
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => close(false)}>
            لاحقًا
          </button>
        </div>
      </div>
    </Dialog>
  )
}
