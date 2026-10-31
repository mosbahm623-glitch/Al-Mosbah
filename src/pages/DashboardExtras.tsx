import { useCallback } from 'react'
import { dateText, money, todayISO } from '../lib/format'
import { fetchMonthly, type MonthRow } from '../lib/monthly'
import { KIND_LABEL, direction, fetchMovements, type Movement } from '../lib/movements'
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
const TONE = { in: 'tone-text-ok', out: 'tone-text-err', neutral: '' } as const
const SIGN = { in: '+', out: '−', neutral: '' } as const
const LATEST = 10

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

const loadLatest = async () => {
  const data = await fetchMovements({ latest: LATEST })
  return { data, error: data === null }
}

/** The ten movements recorded most recently. */
export function LatestMovements() {
  const { data, failed } = useAsync<Movement[]>(loadLatest)
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>آخر القيود</h2>
        <a href="#/recent" className="small">
          عرض الكل
        </a>
      </div>
      {failed && <p className="msg msg-error">مقدرناش نحمّل آخر القيود، جرّب تاني</p>}
      {data && data.length === 0 && <p className="empty">لسه مفيش قيود.</p>}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="sm-hide">التاريخ</th>
                <th className="sm-hide">النوع</th>
                <th>البيان</th>
                <th className="sm-hide">المشروع</th>
                <th>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.key}>
                  <td className="sm-hide">{dateText(m.date)}</td>
                  <td className="sm-hide">{KIND_LABEL[m.kind]}</td>
                  <td className="strong">
                    {m.title || m.category || '—'}
                    {m.project && <span className="sub-line">{m.project}</span>}
                    <span className="sub">
                      {[dateText(m.date), KIND_LABEL[m.kind], m.project].filter(Boolean).join(' · ')}
                    </span>
                  </td>
                  <td className="sm-hide">{m.project ?? '—'}</td>
                  <td className={`num ${TONE[direction(m)]}`}>
                    {SIGN[direction(m)]}
                    {money(m.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
