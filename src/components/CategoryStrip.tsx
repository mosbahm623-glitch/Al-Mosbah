import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { money } from '../lib/core/format'

type Props = {
  items: { name: string; total: number }[]
  allTotal: number
  selected: string | null
  onSelect: (name: string | null) => void
}

/** The بنود as cards in one row you swipe (or step with the arrows); "عرض الكل" lays them all out. Tap a card to pick it, tap again to clear. */
export default function CategoryStrip({ items, allTotal, selected, onSelect }: Props) {
  const [showAll, setShowAll] = useState(false)
  const stripRef = useRef<HTMLDivElement>(null)

  // in RTL the "forward" direction is negative scrollLeft
  function scrollStrip(forward: boolean) {
    const el = stripRef.current
    if (!el) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    const step = Math.max(el.clientWidth * 0.8, 200)
    el.scrollBy({ left: (forward ? 1 : -1) * (rtl ? -1 : 1) * step, behavior: 'smooth' })
  }

  return (
    <section className="panel cat-panel">
      <div className="cat-head">
        <h2 className="section-title">تصنيفات المصروفات</h2>
        <button type="button" className="btn btn-ghost" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'عرض أقل' : 'عرض الكل'}
        </button>
      </div>
      <div className="cat-strip-wrap">
        {!showAll && (
          <button type="button" className="cat-arrow" aria-label="السابق" onClick={() => scrollStrip(false)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        )}
        <div
          ref={stripRef}
          className={`cat-strip ${showAll ? 'cat-strip-all' : ''}`}
          role="group"
          aria-label="تصفية حسب البند"
        >
          <button
            type="button"
            className={`cat-card ${selected === null ? 'cat-card-on' : ''}`}
            aria-pressed={selected === null}
            onClick={() => onSelect(null)}
          >
            <span className="cat-name">الكل</span>
            <span className="cat-total">{money(allTotal)}</span>
            <span className="cat-cur">ج.م</span>
          </button>
          {items.map(({ name, total }) => (
            <button
              key={name}
              type="button"
              className={`cat-card ${selected === name ? 'cat-card-on' : ''}`}
              aria-pressed={selected === name}
              onClick={() => onSelect(selected === name ? null : name)}
            >
              <span className="cat-name">{name}</span>
              <span className="cat-total">{money(total)}</span>
              <span className="cat-cur">ج.م</span>
            </button>
          ))}
        </div>
        {!showAll && (
          <button type="button" className="cat-arrow" aria-label="التالي" onClick={() => scrollStrip(true)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
        )}
      </div>
    </section>
  )
}
