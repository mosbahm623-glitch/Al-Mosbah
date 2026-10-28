import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { toCents } from '../lib/money'
import { footerSpan, isNumericCol, pillOf, showCell } from '../lib/tableFormat'
import type { Section } from '../lib/tableTypes'

const MIN_ROWS_FOR_TOOLS = 6

type Sort = { col: number; dir: 'asc' | 'desc' } | null

/** On-screen data table: click a heading to sort, type to filter, totals stay in view. Print and Excel use their own layouts. */
export default function DataGrid({ section }: { section: Section }) {
  const { heading, cols, rows, footer, empty } = section
  const [sort, setSort] = useState<Sort>(null)
  const [q, setQ] = useState('')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let out = rows.map((r, i) => ({ r, i }))
    if (needle) out = out.filter(({ r }) => r.some((v, ci) => showCell(cols[ci]?.kind, v).toLowerCase().includes(needle)))
    if (sort) {
      const { col, dir } = sort
      const k = dir === 'asc' ? 1 : -1
      out = [...out].sort((a, b) => {
        const x = a.r[col]
        const y = b.r[col]
        if (x === null || x === '') return y === null || y === '' ? a.i - b.i : 1
        if (y === null || y === '') return -1
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ar', { numeric: true })
        return (c || a.i - b.i) * k
      })
    }
    return out.map((o) => o.r)
  }, [rows, cols, q, sort])

  function toggle(ci: number) {
    setSort((s) => (s?.col !== ci ? { col: ci, dir: 'asc' } : s.dir === 'asc' ? { col: ci, dir: 'desc' } : null))
  }

  const filtered = shown.length !== rows.length
  const tools = rows.length >= MIN_ROWS_FOR_TOOLS
  // the footer's own figures are the totals; while filtering, the shown rows get their own sums in the same columns
  const shownSums = filtered && footer ? footer.map((v, ci) => (ci > 0 && typeof v === 'number' ? shown.reduce((t, r) => t + toCents(Number(r[ci]) || 0), 0) / 100 : null)) : null
  const span = footer ? footerSpan(footer, cols.length) : 1

  return (
    <section className="grid-block">
      {(heading || tools) && (
        <div className="grid-head">
          {heading && <h2>{heading}</h2>}
          {tools && (
            <label className="grid-filter">
              <Search size={16} aria-hidden="true" />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث في الجدول" aria-label="بحث في الجدول" autoComplete="off" />
            </label>
          )}
          <span className="grid-count muted small">{filtered ? `${shown.length} من ${rows.length}` : `${rows.length}`} صف</span>
        </div>
      )}
      {rows.length === 0 ? (
        <p className="muted">{empty ?? 'مفيش بيانات.'}</p>
      ) : (
        <div className="grid-scroll">
          <table className="grid">
            <thead>
              <tr>
                {cols.map((c, ci) => {
                  const on = sort?.col === ci
                  return (
                    <th key={c.h} className={isNumericCol(c) ? 'num' : ''} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggle(ci)} title="ترتيب">
                        {c.h}
                        {on ? sort.dir === 'asc' ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" /> : <ChevronsUpDown size={13} className="dim" aria-hidden="true" />}
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={cols.length} className="grid-none">مفيش نتايج للبحث ده.</td>
                </tr>
              )}
              {shown.map((r, ri) => (
                <tr key={ri}>
                  {r.map((v, ci) => (
                    <td key={ci} className={`${isNumericCol(cols[ci]) ? 'num' : ''} ${typeof v === 'number' && v < 0 && cols[ci].kind === 'money' ? 'neg' : ''}`}>
                      {pillOf(cols[ci], v) ? <span className={`tag tag-${pillOf(cols[ci], v)}`}>{showCell(cols[ci].kind, v)}</span> : showCell(cols[ci].kind, v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {footer && (
              <tfoot>
                {shownSums && (
                  <tr className="grid-sub">
                    <td colSpan={span}>إجمالي المعروض ({shown.length})</td>
                    {shownSums.slice(span).map((v, k) => (
                      <td key={k} className={isNumericCol(cols[span + k]) ? 'num' : ''}>{v === null ? '' : showCell(cols[span + k].kind, v)}</td>
                    ))}
                  </tr>
                )}
                <tr>
                  <td colSpan={span}>{footer[0]}</td>
                  {footer.slice(span).map((v, k) => (
                    <td key={k} className={isNumericCol(cols[span + k]) ? 'num' : ''}>{showCell(cols[span + k].kind, v)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}
