import { useState } from 'react'

/**
 * One action at a time. While `fn` is still running, a second call (a double click, a tap on a slow phone, Enter
 * pressed twice) does nothing and returns `undefined`. The lock is a plain flag, not React state, so it closes in the
 * same instant as the first call, before the screen has re-rendered with a disabled button.
 */
export function createSubmitGuard() {
  let busy = false
  return async function run<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (busy) return undefined
    busy = true
    try {
      return await fn()
    } finally {
      busy = false
    }
  }
}

/** The same guard for a component: one lock for the life of the form. */
export function useSubmitGuard() {
  const [guard] = useState(createSubmitGuard)
  return guard
}
