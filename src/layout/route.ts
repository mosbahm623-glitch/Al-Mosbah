import { useSyncExternalStore } from 'react'

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

const read = () => window.location.hash.replace(/^#\/?/, '') || 'dashboard'

/** Hash routing: works on GitHub Pages with no server rewrites. */
export function useRoute() {
  return useSyncExternalStore(subscribe, read, () => 'dashboard')
}
