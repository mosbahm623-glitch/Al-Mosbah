import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { Plus, Search } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import Segmented from '../../components/Segmented'
import { advanceBalance, fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances'
import { money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import AdvanceChip from './AdvanceChip'
import AdvanceDialog from './AdvanceDialog'

const STATUS = [
  { value: 'all', label: 'الكل' },
  { value: 'open', label: 'مفتوحة' },
  { value: 'closed', label: 'مقفولة' },
] as const

export default function Advances() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<(typeof STATUS)[number]['value']>('all')
  const [adding, setAdding] = useState(false)

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (advances.data ?? []).filter(
      (a) =>
        (status === 'all' || a.status === status) &&
        (!term || a.holder_name.toLowerCase().includes(term)),
    )
  }, [advances.data, q, status])

  const total = (f: (a: AdvanceSummary) => number) => rows.reduce((s, a) => s + f(a), 0)

  return (
    <div className="page-stack">
      <PageHead
        title="العهد"
        actions={
          isAdmin && (
            <button className="btn btn-icon" onClick={() => setAdding(true)}>
              <Plus size={18} aria-hidden="true" />
              عهدة جديدة
            </button>
          )
        }
      />

      <Stats
        items={[
          { label: 'المستلم', value: total((a) => a.given) },
          { label: 'المصروف', value: total((a) => a.spent), tone: 'err' },
          { label: 'المرتجع', value: total((a) => a.returned) },
          { label: 'الرصيد مع المستلمين', value: total(advanceBalance), tone: 'ok' },
        ]}
      />

      <div className="toolbar">
        <label className="search-field">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم المستلم" aria-label="بحث في العهد" />
        </label>
        <Segmented label="حالة العهدة" value={status} options={STATUS} onChange={setStatus} />
        <span className="toolbar-note muted small">{rows.length} عهدة</span>
      </div>

      {advances.failed && <p className="msg msg-error">مقدرناش نحمّل العهد، جرّب تاني</p>}
      {advances.loading && !advances.data && <p className="muted">جارٍ التحميل...</p>}
      {advances.data && rows.length === 0 && <div className="card empty">مفيش عهد بالشروط دي.</div>}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المستلم</th>
                  <th>المستلم</th>
                  <th>المصروف</th>
                  <th>المرتجع</th>
                  <th>الرصيد</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const bal = advanceBalance(a)
                  return (
                    <tr key={a.id}>
                      <td className="strong"><a className="row-link" href={`#/advances/${a.id}`}>{a.holder_name}</a></td>
                      <td className="num">{money(a.given)}</td>
                      <td className="num">{money(a.spent)}</td>
                      <td className="num">{money(a.returned)}</td>
                      <td className={`num strong ${bal < 0 ? 'tone-text-err' : ''}`}>{money(bal)}</td>
                      <td><AdvanceChip status={a.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {adding && <AdvanceDialog onClose={() => setAdding(false)} onSaved={advances.reload} />}
    </div>
  )
}
