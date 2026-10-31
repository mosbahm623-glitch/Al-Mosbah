import { useEffect, type RefObject } from 'react'
import { cellLabels } from '../lib/stackTables'

/** Copies each column title onto its cells (`data-label`) so the CSS can show them on a phone, where rows become cards. */
function labelTables(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>('table.table').forEach((table) => {
    const headRow = table.tHead?.rows[0]
    if (!headRow) return
    const heads = Array.from(headRow.cells, (th) => ({
      // the actions column has only a screen-reader title, nothing to show beside the buttons
      label: th.querySelector('.sr-only') ? '' : (th.textContent ?? '').trim(),
      span: th.colSpan,
    }))
    table.querySelectorAll<HTMLTableRowElement>('tbody tr, tfoot tr').forEach((row) => {
      const cells = Array.from(row.cells)
      const labels = cellLabels(
        heads,
        cells.map((c) => c.colSpan),
      )
      cells.forEach((cell, i) => {
        const label = labels[i] ?? ''
        if (cell.dataset.label !== label) cell.dataset.label = label
      })
    })
  })
}

/** Keeps every table under `ref` labelled, including rows that load or change later. */
export function useStackedTables(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current
    if (!root) return
    let frame = 0
    const run = () => {
      frame = 0
      labelTables(root)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run)
    }
    // only added or removed nodes are watched, so setting data-label never re-triggers it
    const observer = new MutationObserver(schedule)
    observer.observe(root, { childList: true, subtree: true })
    run()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [ref])
}
