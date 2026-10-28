import { useCallback, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, FileSpreadsheet, Printer } from 'lucide-react'
import PageHead from '../../components/PageHead'
import { dateText, money, todayISO } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { KIND_LABEL, fetchMovements, shiftDay, totalsOfDay, type Movement } from '../../lib/movements'
import { exportJournalExcel } from '../../lib/exportJournalExcel'

const wrap = async (day: string) => {
  const data = await fetchMovements({ day })
  return { data, error: data === null }
}

export default function Journal() {
  const [day, setDay] = useState(todayISO)
  const load = useCallback(() => wrap(day), [day])
  const { data, failed, loading, reload } = useAsync<Movement[]>(load)
  const [busy, setBusy] = useState(false)
  const [exportFailed, setExportFailed] = useState(false)

  // oldest first, the way a paper journal is read
  const rows = useMemo(() => [...(data ?? [])].sort((a, b) => a.at.localeCompare(b.at) || (a.seq ?? 0) - (b.seq ?? 0)), [data])
  const t = useMemo(() => totalsOfDay(rows), [rows])
  const isToday = day === todayISO()

  async function excel() {
    setBusy(true)
    setExportFailed(false)
    try {
      await exportJournalExcel({ day, rows })
    } catch {
      setExportFailed(true)
    }
    setBusy(false)
  }

  const summary: [string, number][] = [
    ['إجمالي الوارد', t.income],
    ['إجمالي المصروف', t.expense],
    ['دفعات عهد', t.installment],
    ['مرتجع عهد', t.return],
    ['مستحقات مقاولين', t.due],
    ['مدفوعات مقاولين', t.payment],
  ]

  return (
    <div className="page-stack report-page">
      <div className="no-print">
        <PageHead
          title="اليومية"
          parent={{ label: 'التقارير والتصدير', href: '#/reports' }}
          note="كل حركات اليوم المعتمد: وارد ومصروف وعهد ومقاولين."
          actions={
            <>
              <button className="btn btn-icon" onClick={() => window.print()} disabled={rows.length === 0}>
                <Printer size={18} aria-hidden="true" />
                طباعة / PDF
              </button>
              <button className="btn btn-ghost btn-icon" onClick={() => void excel()} disabled={busy || rows.length === 0}>
                <FileSpreadsheet size={18} aria-hidden="true" />
                {busy ? 'جارٍ التجهيز...' : 'Excel'}
              </button>
            </>
          }
        />
        <div className="toolbar">
          <button className="btn btn-ghost btn-icon" onClick={() => setDay(shiftDay(day, -1))} aria-label="اليوم السابق">
            <ChevronRight size={18} aria-hidden="true" />
            السابق
          </button>
          <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="تاريخ اليومية" />
          <button className="btn btn-ghost btn-icon" onClick={() => setDay(shiftDay(day, 1))} disabled={isToday} aria-label="اليوم التالي">
            التالي
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          {!isToday && (
            <button className="btn btn-ghost" onClick={() => setDay(todayISO())}>
              النهاردة
            </button>
          )}
          <button className="btn btn-ghost" onClick={reload} disabled={loading}>
            {loading ? 'جارٍ التحديث...' : 'تحديث'}
          </button>
        </div>
        {failed && <p className="msg msg-error">مقدرناش نحمّل اليومية، جرّب تاني</p>}
        {exportFailed && <p className="msg msg-error">ملف الإكسل ما اتجهزش، جرّب تاني</p>}
      </div>

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>يومية {dateText(day)}</h1>
          </div>
          <dl className="paper-meta">
            <div><dt>عدد الحركات</dt><dd>{t.count}</dd></div>
          </dl>
        </header>

        {loading && !data && <p className="muted">جارٍ التحميل...</p>}
        {data && rows.length === 0 && <p className="muted">مفيش حركات في اليوم ده.</p>}

        {rows.length > 0 && (
          <>
            <table className="paper-table group">
              <thead>
                <tr>
                  <th className="w-seq">رقم</th>
                  <th>النوع</th>
                  <th>البيان</th>
                  <th>المشروع</th>
                  <th>المقاول / العهدة</th>
                  <th>البنك</th>
                  <th>ملاحظات</th>
                  <th className="w-amount">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.key}>
                    <td className="num">{m.seq ?? ''}</td>
                    <td>
                      {KIND_LABEL[m.kind]}
                      {m.fromAdvance && <span className="count"> (من عهدة)</span>}
                    </td>
                    <td>{m.title}</td>
                    <td>{m.project}</td>
                    <td>{m.party}</td>
                    <td>{m.detail}</td>
                    <td>{m.notes}</td>
                    <td className="num">{money(m.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <table className="paper-table summary">
              <thead>
                <tr>
                  {summary.map(([label]) => (
                    <th key={label}>{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {summary.map(([label, value]) => (
                    <td key={label} className="num">{money(value)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            {t.expense !== t.cashExpense && (
              <p className="muted">من المصروف {money(t.expense - t.cashExpense)} اتدفع من عهد، فمتحسبش تاني مع دفعات العهد.</p>
            )}
          </>
        )}

        <footer className="paper-foot">المصباح · يومية {dateText(day)}</footer>
      </article>
    </div>
  )
}
