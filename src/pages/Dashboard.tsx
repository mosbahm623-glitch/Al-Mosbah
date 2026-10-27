import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'

type OverBudget = { id: string; name: string; budget: number; spent: number }

type Summary = {
  total_income: number
  total_expenses: number
  total_advances: number
  contractor_dues: number
  active_projects: number
  net_cash: number
  over_budget: OverBudget[]
}

const nf = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 })
const money = (n: number) => `${nf.format(n)} ج.م`

export default function Dashboard() {
  const { profile, signOut } = useAuth()
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const apply = useCallback((res: unknown, err: unknown) => {
    if (err) {
      setError('مقدرناش نحمّل الأرقام، جرّب تاني')
    } else {
      setError(null)
      setData(res as Summary)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    let active = true
    supabase.rpc('dashboard_summary').then(({ data: res, error: err }) => {
      if (active) apply(res, err)
    })
    return () => {
      active = false
    }
  }, [apply])

  function refresh() {
    setLoading(true)
    supabase.rpc('dashboard_summary').then(({ data: res, error: err }) => apply(res, err))
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div>
          <h1>لوحة التحكم</h1>
          <p className="muted small">{profile?.full_name ?? ''}</p>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-small" onClick={refresh} disabled={loading}>
            {loading ? '...' : 'تحديث'}
          </button>
          <button className="btn btn-small btn-ghost" onClick={() => void signOut()}>
            خروج
          </button>
        </div>
      </header>

      {error && <p className="msg msg-error">{error}</p>}

      {data && (
        <>
          <section className="card hero">
            <span className="muted">صافي النقدية</span>
            <strong className={data.net_cash < 0 ? 'neg' : 'pos'}>{money(data.net_cash)}</strong>
            <span className="muted small">الوارد − المصاريف − العهد + مستحقات المقاولين</span>
          </section>

          <section className="grid">
            <Stat label="إجمالي الوارد" value={money(data.total_income)} />
            <Stat label="إجمالي المصاريف" value={money(data.total_expenses)} />
            <Stat label="إجمالي العهد" value={money(data.total_advances)} />
            <Stat label="مستحقات المقاولين" value={money(data.contractor_dues)} />
            <Stat label="المشاريع النشطة" value={nf.format(data.active_projects)} />
          </section>

          <section className="card">
            <h2>تنبيهات</h2>
            {data.over_budget.length === 0 ? (
              <p className="muted">مفيش مشاريع تجاوزت الميزانية.</p>
            ) : (
              <ul className="alerts">
                {data.over_budget.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    <span>
                      تجاوز الميزانية بـ {money(p.spent - p.budget)} (المصروف {money(p.spent)} من {money(p.budget)})
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card stat">
      <span className="muted small">{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
