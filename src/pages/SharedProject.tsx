import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAsync } from '../lib/core/useAsync'
import Segmented from '../components/Segmented'
import Pager from '../components/Pager'
import Stats from '../components/Stats'
import { dateText, money, timeText } from '../lib/core/format'
import { toCents } from '../lib/core/money'
import { fetchSharedProject, type SharedProject as Shared } from '../lib/projects/shares'
import { usePages } from '../lib/users/usePages'
import { AmountText, KindChip } from '../components/EntryParts'
import { amountTone } from '../lib/entries/entryKind'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
] as const

const REFRESH_MS = 30_000

/** The client's page: one project, read only, refreshed by itself. No sign-in; the link is the key. */
export default function SharedProject({ token }: { token: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]['value']>('all')
  // each fetch is stamped, so "last updated" is the moment the shown data arrived
  const { data, failed, loading, reload } = useAsync<(Shared & { at: string }) | null>(
    useCallback(
      () =>
        fetchSharedProject(token).then(({ data: next, error }) => ({
          data: next ? { ...next, at: new Date().toISOString() } : null,
          error,
        })),
      [token],
    ),
  )

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS)
    const onVisible = () => {
      if (!document.hidden) reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  const state = data ? 'ok' : failed ? 'failed' : loading ? 'loading' : 'invalid'
  const at = data?.at ?? null

  const shown = useMemo(() => (data?.entries ?? []).filter((e) => kind === 'all' || e.kind === kind), [data, kind])
  const pager = usePages(shown)

  return (
    <main className="share-page">
      <header className="share-head">
        <span className="share-brand">Legacy Fine Touch</span>
        {at && <span className="muted small">آخر تحديث {timeText(at)}</span>}
      </header>

      {state === 'loading' && <p className="muted">جارٍ التحميل...</p>}
      {state === 'failed' && <p className="msg msg-error">مقدرناش نحمّل البيانات، جرّب تاني</p>}
      {state === 'invalid' && <div className="card empty">الرابط ده مش شغال. اطلب من المكتب رابط جديد.</div>}

      {state === 'ok' && data && (
        <div className="page-stack">
          <h1 className="page-title">{data.name}</h1>

          <Stats
            items={[
              { label: 'الوارد', value: data.income, tone: 'ok' },
              { label: 'المصروف', value: data.expenses, tone: 'err' },
              {
                label: 'الرصيد',
                value: (toCents(data.income) - toCents(data.expenses)) / 100,
                tone: data.income >= data.expenses ? 'ok' : 'err',
              },
            ]}
          />

          {data.categories.length > 0 && (
            <section className="panel cat-panel">
              <h2 className="section-title">تصنيفات المصروفات</h2>
              <div className="cat-strip cat-strip-all">
                {data.categories.map((c) => (
                  <div key={c.category} className="cat-card cat-card-static">
                    <span className="cat-name">{c.category}</span>
                    <span className="cat-total">{money(c.total)}</span>
                    <span className="cat-cur">ج.م</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="toolbar">
            <h2 className="section-title">القيود</h2>
            <Segmented
              label="نوع القيد"
              value={kind}
              options={KINDS}
              onChange={(k) => {
                setKind(k)
                pager.setPage(1)
              }}
            />
            <span className="toolbar-note muted small">{shown.length} قيد</span>
          </div>

          {shown.length === 0 && <div className="card empty">مفيش قيود.</div>}

          {shown.length > 0 && (
            <section className="panel">
              <div className="table-wrap">
                <table className="table table-grid">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th>البند</th>
                      <th>البيان</th>
                      <th className="col-amt">المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.items.map((e) => (
                      <tr key={e.seq}>
                        <td className="num muted">{dateText(e.entry_date)}</td>
                        <td>
                          <KindChip entry={e} />
                        </td>
                        <td>{e.category}</td>
                        <td className="strong">{e.item}</td>
                        <td className={`num strong col-amt ${amountTone(e)}`}>
                          <AmountText entry={e} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pager {...pager} onChange={pager.setPage} />
            </section>
          )}
        </div>
      )}
    </main>
  )
}
