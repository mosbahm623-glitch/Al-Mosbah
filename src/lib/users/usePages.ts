import { useState } from 'react'

const PAGE_SIZE = 50

/** The page numbers to show: the first, the last and the ones around the current page. `null` marks a gap (…). */
export function pageButtons(page: number, pages: number): (number | null)[] {
  const wanted = [...new Set([1, pages, page - 1, page, page + 1])].filter((n) => n >= 1 && n <= pages)
  const out: (number | null)[] = []
  let last = 0
  for (const n of wanted.sort((a, b) => a - b)) {
    if (n - last === 2) out.push(last + 1)
    else if (n - last > 2) out.push(null)
    out.push(n)
    last = n
  }
  return out
}

/** Splits a list into pages. The current page stays valid when the list shrinks (a filter, a deleted row). */
export function usePages<T>(rows: readonly T[], size = PAGE_SIZE) {
  const [wanted, setPage] = useState(1)
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const page = Math.min(wanted, pages)
  const from = (page - 1) * size
  return {
    page,
    pages,
    setPage,
    items: rows.slice(from, from + size),
    from,
    to: Math.min(from + size, rows.length),
    total: rows.length,
  }
}
