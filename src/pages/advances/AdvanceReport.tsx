import { useState } from 'react'
import { ArrowRight, Printer } from 'lucide-react'
import { advanceBalance } from '../../lib/advances'
import { dateText, money, todayText } from '../../lib/format'
import { useAdvanceData } from '../../lib/useAdvanceData'
import { Kpis, Signatures } from '../../components/PaperExtras'
import { usePreparedBy } from '../../auth/usePreparedBy'

/** Printable statement of one custody: what the holder received, spent (per project) and returned. */
export default function AdvanceReport({ id, embedded }: { id: string; embedded?: { withContractor: boolean; withNotes: boolean } }) {
  const preparedBy = usePreparedBy()
  const withContractor = embedded?.withContractor ?? true
  const withNotes = embedded?.withNotes ?? true
  const { advance, installments, returns, entries, loading, failed } = useAdvanceData(id)
  const [today] = useState(() => todayText())

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الكشف، جرّب تاني</p>
  if (!advance) return <p className="msg msg-error">العهدة مش موجودة</p>

  const balance = advanceBalance(advance)
  const spent = [...(entries ?? [])].filter((e) => e.status === 'approved').sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.seq - b.seq)
  const given = [...(installments ?? [])].sort((a, b) => a.paid_on.localeCompare(b.paid_on))
  const back = [...(returns ?? [])].sort((a, b) => a.returned_on.localeCompare(b.returned_on))

  return (
    <div className="page-stack report-page">
      <div className="report-bar no-print">
        {!embedded && (
          <a className="btn btn-ghost btn-icon" href={`#/advances/${id}`}>
            <ArrowRight size={18} aria-hidden="true" />
            رجوع للعهدة
          </a>
        )}
        <div className="head-actions">
          <button className="btn btn-icon" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            طباعة / PDF
          </button>
        </div>
      </div>

      <article className="paper">
        <header className="paper-head">
          <div>
            <div className="paper-brand">المصباح</div>
            <h1>كشف عهدة: {advance.holder_name}</h1>
          </div>
          <dl className="paper-meta">
            <div><dt>الحالة</dt><dd>{advance.status === 'open' ? 'مفتوحة' : 'مقفولة'}</dd></div>
            <div><dt>تاريخ الكشف</dt><dd>{today}</dd></div>
            {preparedBy && <div><dt>أعدّه</dt><dd>{preparedBy}</dd></div>}
          </dl>
        </header>

        <Kpis
          items={[
            { label: 'المستلم', value: money(advance.given), tone: 'ok' },
            { label: 'المصروف', value: money(advance.spent), tone: 'err' },
            { label: 'المرتجع', value: money(advance.returned), tone: 'warn' },
            { label: 'المتبقي مع المستلم', value: money(balance), tone: 'neutral', neg: balance < 0 },
          ]}
        />

        <h2>الدفعات المستلمة</h2>
        {given.length === 0 ? (
          <p className="muted">مفيش دفعات.</p>
        ) : (
          <table className="paper-table group">
            <thead><tr><th className="w-date">التاريخ</th><th className="w-amount">المبلغ</th></tr></thead>
            <tbody>
              {given.map((i) => (
                <tr key={i.id}><td className="num">{dateText(i.paid_on)}</td><td className="num">{money(i.amount)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td>إجمالي المستلم</td><td className="num">{money(advance.given)}</td></tr></tfoot>
          </table>
        )}

        <h2>المصروفات</h2>
        {spent.length === 0 ? (
          <p className="muted">مفيش مصروفات.</p>
        ) : (
          <table className="paper-table group">
            <thead>
              <tr>
                <th className="w-seq">رقم</th>
                <th className="w-date">التاريخ</th>
                <th>المشروع</th>
                <th>البند</th>
                <th>اسم المصروف</th>
                {withContractor && <th>المقاول</th>}
                {withNotes && <th>ملاحظات</th>}
                <th className="w-amount">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {spent.map((e) => (
                <tr key={e.id}>
                  <td className="num">{e.seq}</td>
                  <td className="num">{dateText(e.entry_date)}</td>
                  <td>{e.project?.name}</td>
                  <td>{e.category}</td>
                  <td>{e.item}</td>
                  {withContractor && <td>{e.contractor?.name}</td>}
                  {withNotes && <td>{e.notes}</td>}
                  <td className="num">{money(e.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={6 + (withContractor ? 1 : 0) + (withNotes ? 1 : 0) - 1}>إجمالي المصروف</td><td className="num">{money(advance.spent)}</td></tr></tfoot>
          </table>
        )}

        {back.length > 0 && (
          <>
            <h2>المرتجع</h2>
            <table className="paper-table group">
              <thead><tr><th className="w-date">التاريخ</th><th>ملاحظات</th><th className="w-amount">المبلغ</th></tr></thead>
              <tbody>
                {back.map((r) => (
                  <tr key={r.id}><td className="num">{dateText(r.returned_on)}</td><td>{r.notes}</td><td className="num">{money(r.amount)}</td></tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={2}>إجمالي المرتجع</td><td className="num">{money(advance.returned)}</td></tr></tfoot>
            </table>
          </>
        )}

        <table className="paper-table grand">
          <tbody>
            <tr><td>المتبقي مع المستلم (المستلم − المصروف − المرتجع)</td><td className="num">{money(balance)}</td></tr>
          </tbody>
        </table>

        <Signatures />

        <footer className="paper-foot">المصباح · عهدة {advance.holder_name} · {today}</footer>
      </article>
    </div>
  )
}
