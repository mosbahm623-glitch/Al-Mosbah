import { useEffect, useState } from 'react'
import { countUnread } from '../lib/notifications'
import { DATA_CHANGED } from '../lib/events'

/** Unread notifications of the signed-in user; follows the live updates. */
export function useUnread() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let active = true
    const load = () => void countUnread().then((n) => active && setCount(n))
    load()
    window.addEventListener(DATA_CHANGED, load)
    return () => {
      active = false
      window.removeEventListener(DATA_CHANGED, load)
    }
  }, [])
  return count
}
