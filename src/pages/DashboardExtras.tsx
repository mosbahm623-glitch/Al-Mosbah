import { useCallback } from 'react'
import { money, todayISO } from '../lib/format'
import { fetchMonthly, type MonthRow } from '../lib/monthly'
import { useAsync } from '../lib/useAsync'

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
