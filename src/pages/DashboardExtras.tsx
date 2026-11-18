import { useCallback } from 'react'
import BankLogo from '../components/BankLogo'
import {
  dashboardBanks,
  fetchBankSummaries,
  fetchBankToday,
  type BankSummary,
  type BankToday,
} from '../lib/banks/banks'
import { money, todayISO } from '../lib/core/format'
import { fetchMonthly, type MonthRow } from '../lib/entries/monthly'
import { useAsync } from '../lib/core/useAsync'

const MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
]
const monthName = (ym: string) => MONTH_NAMES[Number(ym.slice(5)) - 1]

/** Income vs expenses for the last six months (approved entries). */
export function MonthlyChart() {
  const load = useCallback(() => fetchMonthly(todayISO()), [])
  const { data, failed } = useAsync<MonthRow[]>(load)
  const top = Math.max(1, ...(data ?? []).flatMap((r) => [r.income, r.expenses]))

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>الوارد والمصروف شهريًا</h2>
        <span className="muted small">آخر 6 شهور</span>
      </div>
      {failed && <p className="msg msg-error">مقدرناش نحمّل الرسم، جرّب تاني</p>}
      {data && (
        <>
          <div className="mchart" role="img" aria-label="الوارد والمصروف في آخر 6 شهور">
            {data.map((r) => (
              <div className="mchart-col" key={r.month}>
                <div className="mchart-bars">
                  <span
                    className="mbar mbar-in"
                    style={{ height: `${(r.income / top) * 100}%` }}
                    title={`وارد ${money(r.income)} ج.م`}
                  />
                  <span
                    className="mbar mbar-out"
                    style={{ height: `${(r.expenses / top) * 100}%` }}
                    title={`مصروف ${money(r.expenses)} ج.م`}
                  />
                </div>
                <span className="small">{monthName(r.month)}</span>
              </div>
            ))}
          </div>
          <div className="mchart-legend small">
            <span>
              <i className="mbar-in" aria-hidden="true" /> وارد
            </span>
            <span>
              <i className="mbar-out" aria-hidden="true" /> مصروف
            </span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الشهر</th>
                  <th>الوارد</th>
                  <th>المصروف</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.month}>
                    <td className="strong">
                      {monthName(r.month)} {r.month.slice(0, 4)}
                    </td>
                    <td className="num tone-text-ok">{money(r.income)}</td>
                    <td className="num tone-text-err">{money(r.expenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  )
}

/** Current balance of each bank with today's movement, their total and how far it is from the dashboard's net cash. */
export function BankBalances({ netCash }: { netCash: number }) {
  const { data } = useAsync<BankSummary[]>(fetchBankSummaries)
  const today = useAsync<BankToday>(useCallback(() => fetchBankToday(todayISO()), []))
  if (!data?.length) return null
  const { banks, total } = dashboardBanks(data)
  if (!banks.length) return null
  const gap = Math.round((total - netCash) * 100) / 100
  return (
    <section className="panel" aria-label="أرصدة البنوك">
      <div className="panel-head">
        <h2>أرصدة البنوك</h2>
        <span className={`chip ${total < 0 ? 'chip-err' : 'chip-ok'}`}>الإجمالي {money(total)} ج.م</span>
      </div>
      <div className="tiles">
        {banks.map((b) => {
          const t = today.data?.[b.id]
          return (
            <div className="tile" key={b.id}>
              <div className="tile-top">
                <span className="muted small">{b.name}</span>
                <BankLogo logo={b.logo} name={b.name} />
              </div>
              <div className="tile-value">
                <strong className={b.balance < 0 ? 'tone-text-err' : ''}>{money(b.balance)}</strong>
                <span className="muted small">ج.م</span>
              </div>
              {today.data && (
                <div className="muted small">
                  النهارده: وارد {money(t?.income ?? 0)} · مصروف {money(t?.expenses ?? 0)}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <p className="muted small" style={{ margin: '0.75rem 1rem' }}>
        الفرق عن صافي النقدية: {money(gap)} ج.م
      </p>
    </section>
  )
}
