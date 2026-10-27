import { useCallback } from 'react'
import { fetchEntries, fetchSummaries, type Entry, type ProjectSummary } from './projects'
import { useAsync } from './useAsync'

/** One project's totals plus its entries (newest first), loaded together. */
export function useProjectData(id: string) {
  const summaries = useAsync<ProjectSummary[]>(fetchSummaries)
  const entries = useAsync<Entry[]>(useCallback(() => fetchEntries(id), [id]))
  const reloadSummaries = summaries.reload
  const reloadEntries = entries.reload

  return {
    project: summaries.data?.find((p) => p.id === id),
    projects: summaries.data ?? undefined,
    entries: entries.data,
    loading: (summaries.loading && !summaries.data) || (entries.loading && !entries.data),
    failed: summaries.failed || entries.failed,
    reload: useCallback(() => {
      reloadSummaries()
      reloadEntries()
    }, [reloadSummaries, reloadEntries]),
  }
}
