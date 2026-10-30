import { useCallback, useMemo, useState } from 'react'
import { FileSpreadsheet, Printer } from 'lucide-react'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { KIND_LABEL, fetchMovements, totalsOfDay, type Movement } from '../../lib/movements'
import { exportJournalExcel } from '../../lib/exportJournalExcel'
import { Kpis, Signatures } from '../../components/PaperExtras'
import DataGrid from '../../components/DataGrid'
import PrintTables from '../../components/PrintTables'
import type { Section, Tone } from '../../lib/tableTypes'
import { usePreparedBy } from '../../auth/usePreparedBy'
import type { ReportColumns } from '../../lib/reportColumns'

const PILL: Record<string, Tone> = {
  [KIND_LABEL.income]: 'ok',
  [KIND_LABEL.expense]: 'err',
  [KIND_LABEL.installment]: 'warn',
  [KIND_LABEL.return]: 'blue',
  [KIND_LABEL.due]: 'blue',
  [KIND_LABEL.payment]: 'blue',
}

/** One day's journal: every approved movement of that day, with totals per kind. Shown inside the reports page. */
export default function Journal({
  day,
  withContractor,
  withBank: bankWanted,
  withNotes,
}: { day: string } & ReportColumns) {
  const fetchDay = useCallback(async () => {
    const rows = await fetchMovements({ from: day, to: day })
    return { data: rows, error: rows === null }
  }, [day])
  const { data, failed } = useAsync<Movement[]>(fetchDay)
  const preparedBy = usePreparedBy()
  const [busy, setBusy] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  // oldest first, the way a paper journal is read
  const rows = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.at.localeCompare(b.at) || (a.seq ?? 0) - (b.seq ?? 0)),
    [data],
  )
  const t = useMemo(() => totalsOfDay(rows), [rows])
  const withBank = bankWanted && rows.some((m) => m.detail)
  const cols = { withContractor, withBank, withNotes }
  const span = 5 + (withContractor ? 1 : 0) + (withBank ? 1 : 0) + (withNotes ? 1 : 0)

  async function excel() {
    setBusy(true)
    setExportFailed(false)
    try {
      await exportJournalExcel({ day, rows, ...cols })
    } catch {
      setExportFailed(true)
    }
    setBusy(false)
  }

  const section: Section = {
    cols: [
      { h: 'رقم', kind: 'int' },
      { h: 'النوع', pill: (v) => PILL[String(v).split(' (')[0]] },
      { h: 'البند' },
      { h: 'البيان' },
      { h: 'المشروع' },
      ...(withContractor ? [{ h: 'المقاول / العهدة' }] : []),
      ...(withBank ? [{ h: 'البنك' }] : []),
      ...(withNotes ? [{ h: 'ملاحظات' }] : []),
      { h: 'المبلغ', kind: 'money' as const },
    ],
    rows: rows.map((m) => [
      m.seq,
      KIND_LABEL[m.kind] + (m.fromAdvance ? ' (من عهدة)' : ''),
      m.category,
      m.title,
      m.project,
      ...(withContractor ? [m.party] : []),
      ...(withBank ? [m.detail] : []),
      ...(withNotes ? [m.notes] : []),
      m.amount,
    ]),
    footer: [`عدد الحركات: ${t.count}`, ...Array(span).fill(null)],
  }

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل اليومية، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  return (
    <div className="page-stack report-page">
      <div className="report-bar no-print">
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()} disabled={rows.length === 0}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy || rows.length === 0}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            {busy ? 'جارٍ التجهيز...' : 'Excel'}
          </button>
        </div>
      </div>
      {exportFailed && <p className="msg msg-error no-print">ملف الإكسل ما اتجهزش، جرّب تاني</p>}

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>يومية {dateText(day)}</h1>
          </div>
          <dl className="paper-meta">
            <div>
              <dt>عدد الحركات</dt>
              <dd>{t.count}</dd>
            </div>
            {preparedBy && (
              <div>
                <dt>أعدّه</dt>
                <dd>{preparedBy}</dd>
              </div>
            )}
          </dl>
        </header>

        {rows.length === 0 ? (
          <p className="muted">مفيش حركات في اليوم ده.</p>
        ) : (
          <>
            <Kpis
              items={[
                { label: 'إجمالي الوارد', value: money(t.income), tone: 'ok' },
                { label: 'إجمالي المصروف', value: money(t.expense), tone: 'err' },
                { label: 'دفعات عهد', value: money(t.installment), tone: 'warn' },
                { label: 'مرتجع عهد', value: money(t.return), tone: 'blue' },
                { label: 'مستحقات مقاولين', value: money(t.due), tone: 'neutral' },
                { label: 'مدفوعات مقاولين', value: money(t.payment), tone: 'blue' },
              ]}
            />
            <div className="screen-only">
              <DataGrid section={section} />
            </div>
            <PrintTables sections={[section]} ledger />
            {t.expense !== t.cashExpense && (
              <p className="muted small">
                من المصروف {money(t.expense - t.cashExpense)} اتدفع من عهد، فمتحسبش تاني مع دفعات العهد.
              </p>
            )}
          </>
        )}

        <Signatures />
        <footer className="paper-foot">المصباح · يومية {dateText(day)}</footer>
      </article>
    </div>
  )
}
