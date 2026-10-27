import { money } from '../lib/format'

export type Stat = { label: string; value: number; tone?: 'ok' | 'err' }

/** Row of amount tiles (ج.م) used at the top of the detail pages. */
export default function Stats({ items }: { items: Stat[] }) {
  return (
    <section className="stats">
      {items.map((s) => (
        <div className="stat" key={s.label}>
          <span className="muted small">{s.label}</span>
          <strong className={s.tone ? `tone-text-${s.tone}` : undefined}>
            {money(s.value)}
            <small>ج.م</small>
          </strong>
        </div>
      ))}
    </section>
  )
}
