import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { useAuth } from '../../auth/AuthProvider'
import { fetchContractorSummaries, type ContractorRow } from '../../lib/contractors'
import { money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import ContractorDialog from './ContractorDialog'

const owed = (c: ContractorRow) => c.due - c.paid

/** Every contractor with what we owe him, what was paid, and what is left. */
export default function Contractors() {
  const { can } = useAuth()
  const canEdit = can('contractors', 'edit')
  const list = useAsync<ContractorRow[]>(fetchContractorSummaries)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [onlyOwed, setOnlyOwed] = useState(false)

  const all = useMemo(() => list.data ?? [], [list.data])
  const rows = useMemo(
    () =>
      all
        .filter((c) => c.name.includes(q.trim()) && (!onlyOwed || owed(c) > 0))
        .sort((a, b) => owed(b) - owed(a) || a.name.localeCompare(b.name, 'ar')),
    [all, q, onlyOwed],
  )
  const sum = (f: (c: ContractorRow) => number) => all.reduce((s, c) => s + f(c), 0)

  return (
    <div className="page-stack">
      <PageHead
        title="مستحقات المقاولين"
        actions={
          canEdit && (
            <button className="btn btn-icon" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              مقاول جديد
            </button>
          )
        }
      />

      <Stats
        items={[
          { label: 'إجمالي المستحقات', value: sum((c) => c.due) },
          { label: 'المدفوع', value: sum((c) => c.paid), tone: 'ok' },
          { label: 'المتبقي علينا', value: sum(owed), tone: sum(owed) > 0 ? 'err' : 'ok' },
        ]}
      />

      <section className="card contractor-filters">
        <label className="field">
          اسم المقاول
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث بالاسم" />
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyOwed} onChange={(e) => setOnlyOwed(e.target.checked)} />
          اللي ليهم فلوس عندنا بس
        </label>
      </section>

      {list.failed && <p className="msg msg-error">مقدرناش نحمّل المقاولين، جرّب تاني</p>}
      {list.loading && !list.data && <p className="muted">جارٍ التحميل...</p>}
      {list.data && all.length === 0 && (
        <div className="card empty">مفيش مقاولين لسه. ضيف مقاول، أو اكتب اسمه في أي قيد.</div>
      )}
      {list.data && all.length > 0 && rows.length === 0 && <div className="card empty">مفيش مقاول بالاسم ده.</div>}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المقاول</th>
                  <th>مستحقات</th>
                  <th>مدفوع</th>
                  <th>المتبقي</th>
                  <th className="sm-hide">مصروفات مسجلة باسمه</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const left = owed(c)
                  return (
                    <tr key={c.id}>
                      <td className="strong">
                        <a className="row-link" href={`#/contractors/${c.id}`}>
                          {c.name}
                        </a>
                      </td>
                      <td className="num">{money(c.due)}</td>
                      <td className="num tone-text-ok">{money(c.paid)}</td>
                      <td className={`num strong ${left > 0 ? 'tone-text-err' : ''}`}>{money(left)}</td>
                      <td className="num muted sm-hide">{money(c.spent)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adding && <ContractorDialog onClose={() => setAdding(false)} onSaved={list.reload} />}
    </div>
  )
}
