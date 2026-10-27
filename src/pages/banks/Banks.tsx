import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { bankBalance, fetchBankSummaries, type BankSummary } from '../../lib/banks'
import { money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import BankDialog from './BankDialog'

export default function Banks() {
  const { can } = useAuth()
  const canEdit = can('banks', 'edit')
  const banks = useAsync<BankSummary[]>(fetchBankSummaries)
  const [adding, setAdding] = useState(false)
  const rows = banks.data ?? []
  const total = (f: (b: BankSummary) => number) => rows.reduce((s, b) => s + f(b), 0)

  return (
    <div className="page-stack">
      <div className="page-head">
        <div>
          <nav className="crumbs" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <span aria-hidden="true">‹</span>
            <span className="crumb-current">البنوك</span>
          </nav>
          <h1 className="page-title">البنوك</h1>
        </div>
        {canEdit && (
          <button className="btn btn-icon" onClick={() => setAdding(true)}>
            <Plus size={18} aria-hidden="true" />
            بنك جديد
          </button>
        )}
      </div>

      <section className="stats">
        <div className="stat"><span className="muted small">الرصيد الافتتاحي</span><strong>{money(total((b) => b.opening_balance))}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الوارد</span><strong className="tone-text-ok">{money(total((b) => b.income))}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">المصروف</span><strong className="tone-text-err">{money(total((b) => b.expenses))}<small>ج.م</small></strong></div>
        <div className="stat"><span className="muted small">الرصيد الحالي</span><strong className={total(bankBalance) >= 0 ? 'tone-text-ok' : 'tone-text-err'}>{money(total(bankBalance))}<small>ج.م</small></strong></div>
      </section>

      {banks.failed && <p className="msg msg-error">مقدرناش نحمّل البنوك، جرّب تاني</p>}
      {banks.loading && !banks.data && <p className="muted">جارٍ التحميل...</p>}
      {banks.data && rows.length === 0 && <div className="card empty">مفيش بنوك لسه. ضيف بنك، أو اكتب اسم بنك في أي قيد.</div>}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>البنك</th><th>رصيد افتتاحي</th><th>وارد</th><th>مصروف</th><th>الرصيد الحالي</th></tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const bal = bankBalance(b)
                  return (
                    <tr key={b.id}>
                      <td className="strong"><a className="row-link" href={`#/banks/${b.id}`}>{b.name}</a></td>
                      <td className="num">{money(b.opening_balance)}</td>
                      <td className="num tone-text-ok">{money(b.income)}</td>
                      <td className="num tone-text-err">{money(b.expenses)}</td>
                      <td className={`num strong ${bal < 0 ? 'tone-text-err' : ''}`}>{money(bal)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adding && <BankDialog onClose={() => setAdding(false)} onSaved={banks.reload} />}
    </div>
  )
}
