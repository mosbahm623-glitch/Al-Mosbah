import { footerSpan, isNumericCol, pillOf, showCell } from '../lib/tableFormat'
import type { Section } from '../lib/tableTypes'

const widthClass = (kind: string | undefined, i: number, last: boolean) =>
  kind === 'int' && i === 0 ? 'w-seq' : kind === 'date' ? 'w-date' : kind === 'money' && last ? 'w-amount' : undefined

/** "name (3 قيد)": the count part is printed lighter. */
const barTitle = (h: string) => {
  const m = /^(.*?) (\(.*\))$/.exec(h)
  return m ? <>{m[1]} <span className="count">{m[2]}</span></> : h
}

/** The paper tables of a report, shown only when printing. The screen shows the same sections as DataGrids. */
export default function PrintTables({ sections, ledger = false }: { sections: Section[]; ledger?: boolean }) {
  return (
    <div className="print-only">
      {sections.map((s, si) => {
        const span = s.footer ? footerSpan(s.footer, s.cols.length) : 1
        return (
          <section key={s.heading ?? si}>
            {s.heading && !s.bar && <h2>{s.heading}</h2>}
            {s.rows.length === 0 ? (
              <p className="muted">{s.empty ?? 'مفيش بيانات.'}</p>
            ) : (
              <table className={`paper-table group${ledger ? ' ledger' : ''}`}>
                <thead>
                  {s.heading && s.bar && (
                    <tr className="group-title">
                      <th colSpan={s.cols.length}>{barTitle(s.heading)}</th>
                    </tr>
                  )}
                  <tr>
                    {s.cols.map((c, i) => (
                      <th key={c.h} className={widthClass(c.kind, i, i === s.cols.length - 1)}>{c.h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r, ri) => (
                    <tr key={ri}>
                      {r.map((v, ci) => (
                        <td key={ci} className={`${isNumericCol(s.cols[ci]) ? 'num' : ''} ${typeof v === 'number' && v < 0 && s.cols[ci].kind === 'money' ? 'neg' : ''}`}>
                          {pillOf(s.cols[ci], v) ? <span className={`tag tag-${pillOf(s.cols[ci], v)}`}>{showCell(s.cols[ci].kind, v)}</span> : showCell(s.cols[ci].kind, v)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                {s.footer && (
                  <tfoot>
                    <tr>
                      <td colSpan={span}>{s.footer[0]}</td>
                      {s.footer.slice(span).map((v, k) => (
                        <td key={k} className={isNumericCol(s.cols[span + k]) ? 'num' : ''}>{showCell(s.cols[span + k].kind, v)}</td>
                      ))}
                    </tr>
                  </tfoot>
                )}
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}
