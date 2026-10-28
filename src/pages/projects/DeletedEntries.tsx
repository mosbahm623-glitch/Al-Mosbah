import { useCallback, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { fetchProjectDeleted, restoreEntry, type DeletedEntry } from '../../lib/approvals'
import { notifyApprovalsChanged } from '../../lib/events'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'

/** Deleted entries of this project: shown greyed and struck through, never counted in totals or reports. */
export default function DeletedEntries({ projectId }: { projectId: string }) {
  const isAdmin = useAuth().profile?.role === 'admin'
  const { data, reload } = useAsync<DeletedEntry[]>(useCallback(() => fetchProjectDeleted(projectId), [projectId]))
  const [busy, setBusy] = useState<string | null>(null)
  if (!data || data.length === 0) return null

  async function restore(id: string) {
    setBusy(id)
    const ok = await restoreEntry(id)
    setBusy(null)
    if (ok) notifyApprovalsChanged()
    reload()
  }

  return (
    <details className="panel deleted-panel">
      <summary>قيود محذوفة ({data.length}) · مش داخلة في الأرقام ولا التقارير</summary>
      <div className="table-wrap">
        <table className="table deleted-table">
          <thead>
            <tr>
              <th>#</th>
              <th>التاريخ</th>
              <th>البيان</th>
              <th>المبلغ</th>
              <th>اتمسح بواسطة</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id}>
                <td>{e.seq}</td>
                <td>{dateText(e.entry_date)}</td>
                <td>{e.kind === 'income' ? `وارد · ${e.category}` : `${e.category} · ${e.item ?? ''}`}</td>
                <td>{e.kind === 'income' ? '+' : '−'}{money(e.amount)}</td>
                <td>{e.deleted_by_name ?? '—'}</td>
                {isAdmin && (
                  <td>
                    <button className="btn btn-ghost btn-icon" disabled={busy === e.id} onClick={() => void restore(e.id)}>
                      <RotateCcw size={16} aria-hidden="true" />
                      استرجاع
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
