import { useEffect, useRef, useState } from 'react'
import { countUnread } from '../lib/notifications'
import { DATA_CHANGED } from '../lib/events'
import { playChime, unlockChime } from '../lib/chime'

/** Unread notifications of the signed-in user; follows the live updates and rings when a new one arrives. */
export function useUnread() {
  const [count, setCount] = useState(0)
  const previous = useRef<number | null>(null)
  useEffect(() => {
    let active = true
    const load = () =>
      void countUnread().then((n) => {
        if (!active) return
        // the first load only shows what is already waiting: ring just for what arrives after it
        if (previous.current !== null && n > previous.current) playChime()
        previous.current = n
        setCount(n)
      })
    load()
    window.addEventListener(DATA_CHANGED, load)
    const stopUnlock = unlockChime()
    return () => {
      active = false
      window.removeEventListener(DATA_CHANGED, load)
      stopUnlock()
    }
  }, [])
  return count
}
