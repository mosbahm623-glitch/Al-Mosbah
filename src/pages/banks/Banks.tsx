import { useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
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
      <PageHead
        title="البنوك"
        actions={
          canEdit && (
            <button className="btn btn-icon" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              بنك جديد
            </button>
          )
        }
      />

      <Stats
        items={[
          { label: 'الرصيد الافتتاحي', value: total((b) => b.opening_balance) },
          { label: 'الوارد', value: total((b) => b.income), tone: 'ok' },
          { label: 'المصروف', value: total((b) => b.expenses), tone: 'err' },
          { label: 'الرصيد الحالي', value: total(bankBalance), tone: total(bankBalance) >= 0 ? 'ok' : 'err' },
        ]}
      />

      {banks.failed && <p className="msg msg-error">مقدرناش نحمّل البنوك، جرّب تاني</p>}
      {banks.loading && !banks.data && <p className="muted">جارٍ التحميل...</p>}
      {banks.data && rows.length === 0 && (
        <div className="card empty">مفيش بنوك لسه. ضيف بنك، أو اكتب اسم بنك في أي قيد.</div>
      )}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>البنك</th>
                  <th>رصيد افتتاحي</th>
                  <th>وارد</th>
                  <th>مصروف</th>
                  <th>الرصيد الحالي</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const bal = bankBalance(b)
                  return (
                    <tr key={b.id}>
                      <td className="strong">
                        <a className="row-link" href={`#/banks/${b.id}`}>
                          {b.name}
                        </a>
                      </td>
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
