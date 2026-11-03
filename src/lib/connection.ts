/** Whether the app can reach the server right now: the browser's own flag plus what the last request showed. */
const CHANGED = 'connection-changed'
let reachable = true

const browserOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false

export const isOnline = () => browserOnline() && reachable

const emit = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED))
}

/** Called after every request: a network failure marks us offline, any answer from the server marks us online. */
export function setReachable(value: boolean) {
  if (value === reachable) return
  reachable = value
  emit()
}

/** Listens to every change of the connection; returns the function that stops listening. */
export function subscribeConnection(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener('online', onChange)
  window.addEventListener('offline', onChange)
  window.addEventListener(CHANGED, onChange)
  return () => {
    window.removeEventListener('online', onChange)
    window.removeEventListener('offline', onChange)
    window.removeEventListener(CHANGED, onChange)
  }
}

const NETWORK_MESSAGE = /failed to fetch|network ?error|network request failed|load failed|fetch failed|networkerror/i

/** True when a request failed because there was no connection (not because the server refused it). */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { message?: unknown; status?: unknown }
  return e.status === 0 || (typeof e.message === 'string' && NETWORK_MESSAGE.test(e.message))
}
