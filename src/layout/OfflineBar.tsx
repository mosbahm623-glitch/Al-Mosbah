import { useSyncExternalStore } from 'react'
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { isOnline, subscribeConnection } from '../lib/offline/connection'
import { discardQueued, queueSnapshot, retryQueued, subscribeQueue } from '../lib/offline/queue'

/** Shows when the app is offline and lists the entries waiting on this device to be sent. */
export default function OfflineBar() {
  const { session } = useAuth()
  const online = useSyncExternalStore(subscribeConnection, isOnline)
  const all = useSyncExternalStore(subscribeQueue, queueSnapshot)
  const mine = all.filter((q) => q.userId === session?.user.id)
  if (online && mine.length === 0) return null

  const refused = mine.filter((q) => q.error).length
  const waiting = mine.length - refused
  return (
    <div className={`offline-bar ${online ? '' : 'is-offline'}`} role="status">
      <div className="offline-head">
        <CloudOff size={18} aria-hidden="true" />
        <span>
          {online
            ? `${waiting} قيد على جهازك بيتبعت دلوقتي`
            : 'أنت أوفلاين. القيود الجديدة بتتحفظ على جهازك وتتبعت لوحدها لما النت يرجع. التعديل والحذف والموافقات محتاجين نت.'}
          {refused > 0 && ` · ${refused} قيد السيرفر رفضه`}
        </span>
      </div>
      {mine.length > 0 && (
        <details className="offline-list">
          <summary>القيود اللي على جهازك ({mine.length})</summary>
          <ul>
            {mine.map((q) => (
              <li key={q.id}>
                <span className="offline-item">
                  {q.label}
                  {q.error && <small className="offline-err">{q.error}</small>}
                </span>
                {q.error && (
                  <button className="icon-btn" aria-label="إعادة المحاولة" onClick={() => void retryQueued(q.id)}>
                    <RefreshCw size={16} aria-hidden="true" />
                  </button>
                )}
                <button className="icon-btn" aria-label="إلغاء القيد ده" onClick={() => void discardQueued(q.id)}>
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
