import type { MouseEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { pageButtons } from '../lib/usePages'

type Props = {
  page: number
  pages: number
  from: number
  to: number
  total: number
  onChange: (page: number) => void
}

/** Page buttons under a long list. Shows nothing when everything fits on one page. */
export default function Pager({ page, pages, from, to, total, onChange }: Props) {
  if (pages <= 1) return null

  // a new page opens at the top of its list, not at the bottom where the button was
  const go = (e: MouseEvent<HTMLElement>, next: number) => {
    onChange(next)
    e.currentTarget.closest('.panel')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  return (
    <nav className="pager" aria-label="صفحات القائمة">
      <span className="muted small">
        {from + 1}–{to} من {total}
      </span>
      <div className="pager-pages">
        <button type="button" aria-label="الصفحة السابقة" disabled={page === 1} onClick={(e) => go(e, page - 1)}>
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        {pageButtons(page, pages).map((n, i) =>
          n === null ? (
            <span key={`gap-${i}`} className="pager-gap" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`صفحة ${n}`}
              aria-current={n === page ? 'page' : undefined}
              onClick={(e) => go(e, n)}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" aria-label="الصفحة التالية" disabled={page === pages} onClick={(e) => go(e, page + 1)}>
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
