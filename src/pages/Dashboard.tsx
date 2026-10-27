import { useCallback, useEffect, useState } from 'react'
import { FolderKanban, HandCoins, HardHat, Banknote, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import { supabase } from '../lib/supabase'

type BudgetRow = { id: string; name: string; budget: number; spent: number; over: boolean }

type Summary = {
  total_income: number
  total_expenses: number
  total_advances: number
  contractor_dues: number
  active_projects: number
  net_cash: number
  over_count: number
  budget_rows: BudgetRow[]
}

const nf = new Intl.NumberFormat('ar-EG-u-nu-latn', { maximumFractionDigits: 2 })
const money = (n: number) => nf.format(n)

export default function Dashboard() {
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
    <div className="page-stack">
      <div className="page-head">
        <div>
          <nav className="crumbs" aria-label="مسار التنقل">
            <span>الرئيسية</span>
            <span aria-hidden="true">‹</span>
            <span className="crumb-current">لوحة التحكم</span>
          </nav>
          <h1 className="page-title">لوحة التحكم</h1>
        </div>
        <button className="btn" onClick={refresh} disabled={loading}>
          {loading ? 'جارٍ التحديث...' : 'تحديث'}
        </button>
      </div>

      {error && <p className="msg msg-error">{error}</p>}

      {data && (
        <>
          <section className="tiles" aria-label="المؤشرات">
            <Tile label="صافي النقدية" value={money(data.net_cash)} unit="ج.م" icon={Banknote} tone={data.net_cash < 0 ? 'err' : 'ok'} big />
            <Tile label="إجمالي الوارد" value={money(data.total_income)} unit="ج.م" icon={TrendingUp} tone="blue" />
            <Tile label="إجمالي المصاريف" value={money(data.total_expenses)} unit="ج.م" icon={TrendingDown} tone="err" />
            <Tile label="إجمالي العهد" value={money(data.total_advances)} unit="ج.م" icon={HandCoins} tone="neutral" />
            <Tile label="مستحقات المقاولين" value={money(data.contractor_dues)} unit="ج.م" icon={HardHat} tone="warn" />
            <Tile label="المشاريع النشطة" value={nf.format(data.active_projects)} unit="مشروع" icon={FolderKanban} tone="neutral" />
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2>ميزانية المشاريع</h2>
              {data.over_count > 0 ? (
                <span className="chip chip-err">{nf.format(data.over_count)} تنبيه تجاوز</span>
              ) : (
                <span className="chip chip-ok">مفيش تجاوزات</span>
              )}
            </div>
            {data.budget_rows.length === 0 ? (
              <p className="empty">مفيش مشاريع نشطة ليها ميزانية لسه.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>المشروع</th>
                      <th>الميزانية</th>
                      <th>المصروف</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.budget_rows.map((r) => (
                      <tr key={r.id}>
                        <td className="strong">{r.name}</td>
                        <td className="num">{money(r.budget)}</td>
                        <td className="num">{money(r.spent)}</td>
                        <td>
                          <span className={`chip ${r.over ? 'chip-err' : 'chip-ok'}`}>
                            <span className="dot" aria-hidden="true" />
                            {r.over ? 'تجاوز الميزانية' : 'ضمن الميزانية'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Tile({
  label,
  value,
  unit,
  icon: Icon,
  tone,
  big,
}: {
  label: string
  value: string
  unit: string
  icon: LucideIcon
  tone: 'ok' | 'err' | 'blue' | 'warn' | 'neutral'
  big?: boolean
}) {
  return (
    <div className={`tile ${big ? 'tile-big' : ''}`}>
      <div className="tile-top">
        <span className="muted small">{label}</span>
        <span className={`chip-icon tone-${tone}`}>
          <Icon size={17} aria-hidden="true" />
        </span>
      </div>
      <div className="tile-value">
        <strong className={big ? `tone-text-${tone}` : ''}>{value}</strong>
        <span className="muted small">{unit}</span>
      </div>
    </div>
  )
}
