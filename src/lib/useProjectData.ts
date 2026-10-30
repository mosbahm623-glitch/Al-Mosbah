import { useCallback, useMemo } from 'react'
import { fetchProjectDeleted, type DeletedEntry } from './approvals'
import { fetchEntries, fetchSummaries, type Entry, type ProjectSummary } from './projects'
import { useAsync } from './useAsync'

const asEntry = (d: DeletedEntry): Entry => ({
  id: d.id,
  seq: d.seq,
  rev: d.rev,
  kind: d.kind,
  category: d.category,
  item: d.item,
  amount: d.amount,
  entry_date: d.entry_date,
  notes: d.notes,
  advance_id: null,
  status: 'deleted',
  deleteReason: d.delete_reason,
  contractor: d.contractor ? { name: d.contractor } : null,
  bank: null,
  creator: { full_name: d.created_by_name },
})

/** One project's totals plus its entries (newest first), loaded together. Deleted entries sit in their place, marked, and are never counted. */
export function useProjectData(id: string) {
  const summaries = useAsync<ProjectSummary[]>(fetchSummaries)
  const entries = useAsync<Entry[]>(useCallback(() => fetchEntries(id), [id]))
  const deleted = useAsync<DeletedEntry[]>(useCallback(() => fetchProjectDeleted(id), [id]))
  const reloadSummaries = summaries.reload
  const reloadEntries = entries.reload
  const reloadDeleted = deleted.reload

  const all = useMemo(
    () =>
      entries.data ? [...entries.data, ...(deleted.data ?? []).map(asEntry)].sort((a, b) => b.seq - a.seq) : undefined,
    [entries.data, deleted.data],
  )

  return {
    project: summaries.data?.find((p) => p.id === id),
    projects: summaries.data ?? undefined,
    entries: all,
    loading: (summaries.loading && !summaries.data) || (entries.loading && !entries.data),
    failed: summaries.failed || entries.failed,
    reload: useCallback(() => {
      reloadSummaries()
      reloadEntries()
      reloadDeleted()
    }, [reloadSummaries, reloadEntries, reloadDeleted]),
  }
}
