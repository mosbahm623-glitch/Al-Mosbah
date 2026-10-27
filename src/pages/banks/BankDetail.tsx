import { useCallback, useMemo, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { bankBalance, byProject, fetchBankMovements, fetchBankSummaries, type BankMovement, type BankSummary } from '../../lib/banks'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import BankDialog from './BankDialog'

export default function BankDetail({ id }: { id: string }) {
  const { can } = useAuth()
  const canEdit = can('banks', 'edit')
  const summaries = useAsync<BankSummary[]>(fetchBankSummaries)
  const movements = useAsync<BankMovement[]>(useCallback(() => fetchBankMovements(id), [id]))
  const [editing, setEditing] = useState(false)
  const bank = summaries.data?.find((b) => b.id === id)
  const rows = movements.data

  // running balance, oldest first
  const withBalance = useMemo(() => {
    const out: { m: BankMovement; run: number }[] = []
    for (const m of rows ?? []) {
      const prev = out.length ? out[out.length - 1].run : (bank?.opening_balance ?? 0)
      out.push({ m, run: prev + (m.kind === 'income' ? m.amount : -m.amount) })
    }
    return out
  }, [rows, bank?.opening_balance])
  const projects = useMemo(() => byProject(rows ?? []), [rows])

  if ((summaries.loading && !summaries.data) || (movements.loading && !movements.data)) return <p className="muted">جارٍ التحميل...</p>
  if (summaries.failed || movements.failed) return <p className="msg msg-error">مقدرناش نحمّل البنك، جرّب تاني</p>
  if (!bank) {
    return (
      <div className="page-stack">
        <h1 className="page-title">البنك مش موجود</h1>
        <a className="btn btn-ghost" href="#/banks">رجوع للبنوك</a>
      </div>
    )
  }

  const balance = bankBalance(bank)
  const reload = () => {
    summaries.reload()
    movements.reload()
  }

  return (
    <div className="page-stack">
      <div className="page-head">
        <div>
          <nav className="crumbs" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <span aria-hidden="true">‹</span>
            <a href="#/banks">البنوك</a>
            <span aria-hidden="true">‹</span>
            <span className="crumb-current">{bank.name}</span>
          </nav>
          <h1 className="page-title">{bank.name}</h1>
        </div>
        {canEdit && (
          <div className="head-actions">
            <button className="btn btn-ghost btn-icon" onClick={() => setEditing(true)}>
              <Pencil size={18} aria-hidden="true" />
              تعديل
            </button>
          </div>
        )}
      </div>

      <section className="stats">
        <div className="stat"><span className="muted small">الرصيد الافتتاحي</span><strong>{money(bank.opening_balance)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الوارد</span><strong className="tone-text-ok">{money(bank.income)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">المصروف</span><strong className="tone-text-err">{money(bank.expenses)}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الرصيد الحالي</span><strong className={balance >= 0 ? 'tone-text-ok' : 'tone-text-err'}>{money(balance)}<small>ج.م</small></strong></div>
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="section-title">حسب المشروع</h2></div>
        {projects.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>المشروع</th><th>وارد</th><th>مصروف</th><th>الصافي</th></tr></thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td className="strong"><a className="row-link" href={`#/projects/${p.id}`}>{p.name}</a></td>
                    <td className="num tone-text-ok">{money(p.income)}</td>
                    <td className="num tone-text-err">{money(p.expenses)}</td>
                    <td className="num strong">{money(p.income - p.expenses)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty muted">مفيش حركات على البنك ده لسه.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head"><h2 className="section-title">الحركات</h2></div>
        {withBalance.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>رقم القيد</th><th>التاريخ</th><th>المشروع</th><th>البيان</th><th>المقاول</th><th>وارد</th><th>مصروف</th><th>الرصيد</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={7} className="muted">رصيد افتتاحي</td>
                  <td className="num strong">{money(bank.opening_balance)}</td>
                </tr>
                {withBalance.map(({ m, run }) => (
                  <tr key={m.id}>
                    <td className="strong num">#{m.seq}</td>
                    <td className="num muted">{dateText(m.entry_date)}</td>
                    <td>{m.project_name}</td>
                    <td>{m.kind === 'income' ? m.category : `${m.category} · ${m.item ?? ''}`}</td>
                    <td className="muted">{m.contractor}</td>
                    <td className="num tone-text-ok">{m.kind === 'income' ? money(m.amount) : ''}</td>
                    <td className="num tone-text-err">{m.kind === 'expense' ? money(m.amount) : ''}</td>
                    <td className="num strong">{money(run)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty muted">مفيش حركات.</p>
        )}
      </section>

      {editing && <BankDialog bank={bank} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  )
}
