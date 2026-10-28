import { useState } from 'react'
import PageHead from '../../components/PageHead'
import { todayISO } from '../../lib/format'
import ContractorsSummary from '../reports/ContractorsSummary'

/** What we owe every contractor: balance before the period, dues, payments and what is left to pay. */
export default function Contractors() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const rangeOk = !from || !to || from <= to

  return (
    <div className="page-stack">
      <div className="no-print">
        <PageHead title="مستحقات المقاولين" />
        <section className="panel ctl" aria-label="الفترة">
          <label className="field">
            من تاريخ
            <input type="date" value={from} max={todayISO()} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field">
            إلى تاريخ
            <input type="date" value={to} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
          </label>
        </section>
      </div>
      {rangeOk ? <ContractorsSummary from={from} to={to} /> : <p className="msg msg-error no-print">تاريخ البداية لازم يكون قبل تاريخ النهاية</p>}
    </div>
  )
}
