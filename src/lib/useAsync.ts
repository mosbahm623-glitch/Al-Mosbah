import { useCallback, useEffect, useState } from 'react'

type Result<T> = PromiseLike<{ data: T | null; error: unknown }>

/** Runs `fn` on mount (and whenever `fn` changes); `reload()` runs it again. `fn` must be memoized. */
export function useAsync<T>(fn: () => Result<T>) {
  const [state, setState] = useState<{ data: T | null; failed: boolean; loading: boolean }>({
    data: null,
    failed: false,
    loading: true,
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let active = true
    fn().then(({ data, error }) => {
      if (active) setState({ data, failed: Boolean(error), loading: false })
    })
    return () => {
      active = false
    }
  }, [fn, tick])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    setTick((t) => t + 1)
  }, [])
  return { ...state, reload }
}
