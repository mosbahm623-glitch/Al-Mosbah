import { useCallback, useMemo, useState } from 'react'
import { Split, Undo2 } from 'lucide-react'
import { dateText, money } from '../../lib/core/format'
import { useAsync } from '../../lib/core/useAsync'
import {
  distributedCents,
  fetchDistributions,
  fetchPaymentEntries,
  freeCents,
  sumCents,
  undoDistribution,
  type Distribution,
  type PaymentEntry,
} from '../../lib/contractors/distribution'
import DistributeDialog from './DistributeDialog'

type Load = { entries: PaymentEntry[]; dists: Distribution[] }

/**
 * The contractor's payments (expense entries under his name) per project, and what they were spread over.
 * Spreading never changes the entries; it only makes reports by بند show the work instead of the payments.
 */
export default function ContractorWork({ id, name, canEdit }: { id: string; name: string; canEdit: boolean }) {
  const load = useAsync<Load>(
    useCallback(async () => {
      const [entries, dists] = await Promise.all([fetchPaymentEntries(id), fetchDistributions({ contractorId: id })])
      return { data: entries && dists ? { entries, dists } : null, error: !entries || !dists }
    }, [id]),
  )
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState<{ projectId: string; projectName: string; ids: string[]; available: number } | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)

  const view = useMemo(() => {
    const entries = load.data?.entries ?? []
    const dists = load.data?.dists ?? []
    const by = distributedCents(dists)
    const groups = new Map<string, { id: string; name: string; entries: PaymentEntry[]; dists: Distribution[] }>()
    for (const e of entries) {
      const g = groups.get(e.project_id) ?? { id: e.project_id, name: e.project?.name ?? '—', entries: [], dists: [] }
      g.entries.push(e)
      groups.set(e.project_id, g)
    }
    for (const d of dists) groups.get(d.project_id)?.dists.push(d)
    return {
      by,
      groups: [...groups.values()]
        .filter((g) => g.entries.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    }
  }, [load.data])

  if (load.failed || (load.loading && !load.data)) return null
  if (!view.groups.length) return null

  const toggle = (entryId: string) => {
    const next = new Set(picked)
    if (!next.delete(entryId)) next.add(entryId)
    setPicked(next)
  }

  async function undo(d: Distribution) {
    setError(null)
    const { error: err } = await undoDistribution(d.id)
    if (err) return setError('ما اتلغاش التوزيع، جرّب تاني')
    load.reload()
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">دفعاته وأعماله</h2>
      </div>
      <p className="muted small">
        القيود المسجّلة باسمه في كل مشروع. اختار الدفعات ووزّعها على الأعمال اللي عملها: القيود نفسها (النقدية والبنوك) مش
        بتتغيّر، وتقارير البنود بتعرض الأعمال بدل الدفعات.
      </p>
      {error && <p className="msg msg-error">{error}</p>}
      {view.groups.map((g) => {
        const free = g.entries.reduce((s, e) => s + freeCents(e, view.by), 0) / 100
        const chosen = g.entries.filter((e) => picked.has(e.id) && freeCents(e, view.by) > 0)
        const chosenFree = chosen.reduce((s, e) => s + freeCents(e, view.by), 0) / 100
        return (
          <div key={g.id} style={{ marginBottom: '1.2rem' }}>
            <div className="panel-head">
              <h3 className="section-title">{g.name}</h3>
              {canEdit && (
                <button
                  className="btn btn-ghost btn-icon"
                  disabled={!chosen.length}
                  onClick={() =>
                    setOpen({
                      projectId: g.id,
                      projectName: g.name,
                      ids: chosen.map((e) => e.id),
                      available: chosenFree,
                    })
                  }
                >
                  <Split size={16} aria-hidden="true" />
                  وزّعها على أعمال{chosen.length ? ` (${money(chosenFree)})` : ''}
                </button>
              )}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    {canEdit && <th aria-label="اختيار" />}
                    <th>التاريخ</th>
                    <th>البيان</th>
                    <th className="sm-hide">البنك</th>
                    <th>المبلغ</th>
                    <th>اتوزّع</th>
                  </tr>
                </thead>
                <tbody>
                  {g.entries.map((e) => {
                    const done = (view.by.get(e.id) ?? 0) / 100
                    const isFree = freeCents(e, view.by) > 0
                    return (
                      <tr key={e.id}>
                        {canEdit && (
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`اختيار القيد ${e.seq}`}
                              disabled={!isFree}
                              checked={picked.has(e.id) && isFree}
                              onChange={() => toggle(e.id)}
                            />
                          </td>
                        )}
                        <td>{dateText(e.entry_date)}</td>
                        <td>{e.item ?? e.category}</td>
                        <td className="sm-hide muted">{e.bank?.name ?? ''}</td>
                        <td className="num">{money(e.amount)}</td>
                        <td className="num muted">{done > 0 ? money(done) : ''}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted small">
              تحت الحساب (لسه ما اتوزّعش): <strong>{money(free)}</strong> ج.م
              {sumCents(g.entries) > 0 && ` من ${money(sumCents(g.entries) / 100)}`}
            </p>
            {g.dists.map((d) => (
              <div key={d.id} className="muted small" style={{ marginBottom: '0.5rem' }}>
                <strong>توزيع {dateText(d.created_at.slice(0, 10))}:</strong>{' '}
                {d.items
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((it) => `${it.item} (${it.category}) ${money(it.amount)}`)
                  .join('، ')}
                {canEdit && (
                  <button className="btn btn-ghost btn-icon" onClick={() => void undo(d)} aria-label="تراجع عن التوزيع">
                    <Undo2 size={14} aria-hidden="true" />
                    تراجع
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      })}
      {open && (
        <DistributeDialog
          contractorId={id}
          name={name}
          projectId={open.projectId}
          projectName={open.projectName}
          entryIds={open.ids}
          available={open.available}
          onClose={() => setOpen(null)}
          onSaved={() => {
            setPicked(new Set())
            load.reload()
          }}
        />
      )}
    </section>
  )
}
