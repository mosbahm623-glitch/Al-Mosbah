import { useEffect, useState } from 'react'
import { countPending } from '../lib/approvals'
import { APPROVALS_CHANGED } from '../lib/events'
import { useRoute } from './route'

/** Entries waiting for approval (admins only); refreshed on navigation, after a decision and every minute. */
export function usePendingCount(enabled: boolean) {
  const [count, setCount] = useState(0)
  const route = useRoute()

  useEffect(() => {
    if (!enabled) return
    let active = true
    const load = () => void countPending().then((n) => active && setCount(n))
    load()
    window.addEventListener(APPROVALS_CHANGED, load)
    const timer = window.setInterval(load, 60_000)
    return () => {
      active = false
      window.removeEventListener(APPROVALS_CHANGED, load)
      window.clearInterval(timer)
    }
  }, [enabled, route])

  return enabled ? count : 0
}
