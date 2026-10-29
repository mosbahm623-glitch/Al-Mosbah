import { useState } from 'react'
import { FileSpreadsheet, MessageCircle, Printer } from 'lucide-react'
import { todayText } from '../lib/format'
import type { Kpi, Section } from '../lib/tableTypes'
import { exportTableExcel } from '../lib/exportTableExcel'
import { reportSummaryText, whatsappLink } from '../lib/whatsapp'
import { usePreparedBy } from '../auth/usePreparedBy'
import { Kpis, Signatures } from './PaperExtras'
import DataGrid from './DataGrid'
import PrintTables from './PrintTables'

type Props = {
  title: string
  filename: string
  meta?: { label: string; value: string }[]
  kpis?: Kpi[]
  sections: Section[]
  note?: string
}

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
          <a
            className="btn btn-ghost btn-icon"
            href={whatsappLink(reportSummaryText(title, [...meta, ...(kpis ?? []).map((k) => ({ label: k.label, value: k.value }))]))}
            target="_blank"
            rel="noreferrer"
            aria-disabled={empty}
          >
            <MessageCircle size={18} aria-hidden="true" />
            واتساب
          </a>
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

        <div className="screen-only">
          {sections.map((s, i) => (
            <DataGrid key={s.heading ?? i} section={s} />
          ))}
        </div>

        <PrintTables sections={sections} ledger />

        {note && <p className="muted small note">{note}</p>}
        <Signatures />
        <footer className="paper-foot">المصباح · {title} · {today}</footer>
      </article>
    </div>
  )
}
