import { useCallback } from 'react'
import { useAsync } from '../core/useAsync'
import { fetchSummaries, type ProjectSummary } from './projects'

/** The projects an entry being edited can be moved to: the page's own list, or loaded when the page gave none. */
export function useEntryProjects(editing: boolean, given?: ProjectSummary[]) {
  const load = useCallback(
    () => (editing && !given ? fetchSummaries() : Promise.resolve({ data: null, error: null })),
    [editing, given],
  )
  const loaded = useAsync<ProjectSummary[]>(load)
  return given ?? loaded.data ?? undefined
}
