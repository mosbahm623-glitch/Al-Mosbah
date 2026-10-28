import type { Kpi } from '../lib/tableTypes'

/** Summary cards at the top of a printed report. */
export function Kpis({ items }: { items: Kpi[] }) {
  return (
    <div className="kpis" style={{ '--cols': items.length <= 5 ? items.length : 3 } as React.CSSProperties}>
      {items.map((k) => (
        <div key={k.label} className={`kpi kpi-${k.tone ?? 'blue'} ${k.neg ? 'neg' : ''}`}>
          <small>{k.label}</small>
          <b>{k.value}</b>
        </div>
      ))}
    </div>
  )
}

/** Signature lines at the bottom of a printed report. */
export function Signatures() {
  return (
    <div className="sign">
      <div>المحاسب</div>
      <div>المراجع</div>
      <div>الاعتماد</div>
    </div>
  )
}
