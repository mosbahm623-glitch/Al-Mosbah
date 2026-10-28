import { useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { dateText, money, todayText } from '../lib/format'
import { exportTableExcel } from '../lib/exportTableExcel'
import { usePreparedBy } from '../auth/usePreparedBy'
import { Kpis, Signatures, type Kpi } from './PaperExtras'

export type Cell = string | number | null
export type Col = { h: string; kind?: 'text' | 'money' | 'date' | 'int' }
export type Section = { heading?: string; cols: Col[]; rows: Cell[][]; footer?: Cell[]; empty?: string }

type Props = {
  title: string
  filename: string
  meta?: { label: string; value: string }[]
  kpis?: Kpi[]
  sections: Section[]
  note?: string
}

const show = (kind: Col['kind'], v: Cell) => {
  if (v === null || v === '') return ''
  if (kind === 'money' && typeof v === 'number') return money(v)
  if (kind === 'date' && typeof v === 'string') return dateText(v)
  return String(v)
}
const numeric = (c: Col) => c.kind === 'money' || c.kind === 'int' || c.kind === 'date'

/** A printable table report: header, summary cards, one or more tables with totals, signatures. Print and Excel come with it. */
export default function TableReport({ title, filename, meta = [], kpis, sections, note }: Props) {
  const preparedBy = usePreparedBy()
  const [today] = useState(() => todayText())
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const empty = sections.every((s) => s.rows.length === 0)

  async function excel() {
    setBusy(true)
    setFailed(false)
    try {
      await exportTableExcel({ title, sheet: title, filename, meta, kpis, sections })
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  return (
    <div className="page-stack report-page">
      <div className="report-bar no-print">
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()} disabled={empty}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy || empty}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {busy ? 'جارٍ التجهيز...' : 'Excel'}
          </button>
        </div>
      </div>
      {failed && <p className="msg msg-error no-print">ملف الإكسل ما اتجهزش، جرّب تاني</p>}

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>{title}</h1>
          </div>
          <dl className="paper-meta">
            {meta.map((m) => (
              <div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>
            ))}
            <div><dt>تاريخ التقرير</dt><dd>{today}</dd></div>
            {preparedBy && <div><dt>أعدّه</dt><dd>{preparedBy}</dd></div>}
          </dl>
        </header>

        {kpis && <Kpis items={kpis} />}

        {sections.map((s, i) => {
          const lead = s.footer ? Math.max(1, s.footer.findIndex((v, j) => j > 0 && v !== null && v !== '')) : 1
          const span = s.footer && s.footer.findIndex((v, j) => j > 0 && v !== null && v !== '') === -1 ? s.cols.length : lead
          return (
            <section key={s.heading ?? i}>
              {s.heading && <h2>{s.heading}</h2>}
              {s.rows.length === 0 ? (
                <p className="muted">{s.empty ?? 'مفيش بيانات.'}</p>
              ) : (
                <table className="paper-table group ledger">
                  <thead>
                    <tr>
                      {s.cols.map((c) => (
                        <th key={c.h}>{c.h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.rows.map((r, ri) => (
                      <tr key={ri}>
                        {r.map((v, ci) => (
                          <td key={ci} className={`${numeric(s.cols[ci]) ? 'num' : ''} ${typeof v === 'number' && v < 0 && s.cols[ci].kind === 'money' ? 'neg' : ''}`}>
                            {show(s.cols[ci].kind, v)}
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
                          <td key={k} className={numeric(s.cols[span + k]) ? 'num' : ''}>
                            {show(s.cols[span + k].kind, v)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  )}
                </table>
              )}
            </section>
          )
        })}

        {note && <p className="muted small">{note}</p>}
        <Signatures />
        <footer className="paper-foot">المصباح · {title} · {today}</footer>
      </article>
    </div>
  )
}
