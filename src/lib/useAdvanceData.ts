import { useCallback } from 'react'
import {
  fetchAdvanceEntries,
  fetchAdvanceSummaries,
  fetchInstallments,
  fetchReturns,
  type AdvanceReturn,
  type AdvanceSummary,
  type Installment,
} from './advances'
import type { Entry } from './projects'
import { useAsync } from './useAsync'

/** One custody: its totals, installments, returns and the expenses paid from it. */
export function useAdvanceData(id: string) {
  const summaries = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const installments = useAsync<Installment[]>(useCallback(() => fetchInstallments(id), [id]))
  const returns = useAsync<AdvanceReturn[]>(useCallback(() => fetchReturns(id), [id]))
  const entries = useAsync<Entry[]>(useCallback(() => fetchAdvanceEntries(id), [id]))
  const all = [summaries, installments, returns, entries]
  const reloadSummaries = summaries.reload
  const reloadInstallments = installments.reload
  const reloadReturns = returns.reload
  const reloadEntries = entries.reload

  return {
    advance: summaries.data?.find((a) => a.id === id),
    installments: installments.data,
    returns: returns.data,
    entries: entries.data,
    loading: all.some((a) => a.loading && !a.data),
    failed: all.some((a) => a.failed),
    reload: useCallback(() => {
      reloadSummaries()
      reloadInstallments()
      reloadReturns()
      reloadEntries()
    }, [reloadSummaries, reloadInstallments, reloadReturns, reloadEntries]),
  }
}
