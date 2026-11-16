import { CheckSquare, Copy } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { fetchPendingSummary } from '../lib/approvals'
import { fetchDuplicateGroups, summarizeDuplicates } from '../lib/duplicates'
import { money } from '../lib/format'
import { useAsync } from '../lib/useAsync'

const link = { color: 'inherit', textDecoration: 'none', display: 'block' } as const

/** Admin only: two cards that point at work waiting to be done (approvals, entries that look the same). */
export function AttentionCards() {
  const { isAdmin } = useAuth()
  if (!isAdmin) return null
  return (
    <section className="tiles" aria-label="محتاجة مراجعة">
      <PendingCard />
      <DuplicatesCard />
    </section>
  )
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

function DuplicatesCard() {
  const { data } = useAsync(fetchDuplicateGroups)
  if (!data) return null
  const s = summarizeDuplicates(data)
  return (
    <a className="tile" href="#/duplicates" style={link}>
      <div className="tile-top">
        <span className="muted small">قيود متطابقة</span>
        <span className={`chip-icon ${s.groups ? 'tone-warn' : 'tone-ok'}`}>
          <Copy size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="tile-value">
        <strong>{money(s.groups)}</strong>
        <span className="muted small">مجموعة</span>
      </div>
      <div className="muted small">
        {s.groups === 0 ? 'مفيش قيود متطابقة' : `${money(s.extraEntries)} قيد زيادة · راجعها من هنا`}
      </div>
    </a>
  )
}
