import { CheckSquare } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { fetchPendingSummary } from '../lib/approvals'
import { money } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const link = { color: 'inherit', textDecoration: 'none', display: 'block' } as const

/** Admin only: a tile (placed inside the dashboard tiles grid) that points at the work waiting for his approval. */
export function AttentionCards() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return <PendingCard />
}

function PendingCard() {
  const { data } = useAsync(fetchPendingSummary)
  if (!data) return null
  const count = data.entries.count + data.payments.count
  const total = data.entries.total + data.payments.total
  return (
    <a className="tile" href="#/approvals" style={link}>
      <div className="tile-top">
        <span className="muted small">مستني موافقتك</span>
        <span className={`chip-icon ${count ? 'tone-warn' : 'tone-ok'}`}>
          <CheckSquare size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="tile-value">
        <strong>{money(total)}</strong>
        <span className="muted small">ج.م</span>
      </div>
      <div className="muted small">
        {count === 0
          ? 'مفيش حاجة مستنية'
          : `${data.entries.count} قيد (${money(data.entries.total)}) · ${data.payments.count} دفعة عهد (${money(data.payments.total)})`}
      </div>
    </a>
  )
}
