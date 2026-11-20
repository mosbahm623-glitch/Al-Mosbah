import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { ALL_ITEMS } from './nav'

// the paths currently open as tabs, shared so the page area knows which pages to keep alive
let openPaths: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()
function publish(tabs: Tab[]) {
  openPaths = new Set(tabs.map((t) => t.path))
  listeners.forEach((l) => l())
}
const subscribeOpen = (cb: () => void) => {
  listeners.add(cb)
  return () => void listeners.delete(cb)
}
export const useOpenPaths = () => useSyncExternalStore(subscribeOpen, () => openPaths)

/** Search reads its text from the address, so it always starts fresh instead of staying alive. */
export const keepsAlive = (route: string) => route !== 'search' && labelOf(route) !== null

export type Tab = { path: string; label: string }

const MAX = 10
const DETAIL = /^(projects|advances|banks|contractors)\/[0-9a-f-]{36}$/
const DETAIL_LABEL = { projects: 'مشروع', advances: 'عهدة', banks: 'بنك', contractors: 'مقاول' } as const

/** Pages that get a tab: the main pages and the detail page of a project, custody, bank or contractor. */
function labelOf(route: string): string | null {
  const item = ALL_ITEMS.find((i) => i.path === route)
  if (item) return item.label
  if (DETAIL.test(route)) return DETAIL_LABEL[route.split('/')[0] as keyof typeof DETAIL_LABEL]
  return null
}

function withRoute(list: Tab[], route: string): Tab[] {
  const label = labelOf(route)
  return !label || list.some((t) => t.path === route) ? list : [...list, { path: route, label }].slice(-MAX)
}

function load(key: string): Tab[] {
  try {
    const list = JSON.parse(sessionStorage.getItem(key) ?? '[]') as Tab[]
    return Array.isArray(list) ? list.filter((t) => typeof t.path === 'string' && typeof t.label === 'string') : []
  } catch {
    return []
  }
}

/**
 * The pages opened in this browser tab, shown as a bar of tabs. Kept per person in sessionStorage, so closing the
 * browser (or signing out) clears them. A tab's name starts as the page type and becomes the page's own title
 * (the project's or contractor's name) as soon as the page has drawn it.
 */
export function useTabs(route: string, uid: string) {
  const key = `mosbah-tabs:${uid}`
  const [tabs, setTabs] = useState<Tab[]>(() => withRoute(load(key), route))
  const [seen, setSeen] = useState(route)
  if (seen !== route) {
    // a new page was opened: it gets its tab right away (adjusting state while rendering, not in an effect)
    setSeen(route)
    setTabs((prev) => withRoute(prev, route))
  }

  useEffect(() => {
    publish(tabs)
    try {
      sessionStorage.setItem(key, JSON.stringify(tabs))
    } catch {
      /* private mode: the tabs just live until the page reloads */
    }
  }, [key, tabs])

  useEffect(() => {
    if (!labelOf(route)) return
    let tries = 0
    const id = window.setInterval(() => {
      const title = document.querySelector(`.content [data-page="${route}"] .page-title`)?.textContent?.trim()
      if (title) {
        setTabs((prev) => prev.map((t) => (t.path === route && t.label !== title ? { ...t, label: title } : t)))
        window.clearInterval(id)
      } else if (++tries > 25) {
        window.clearInterval(id)
      }
    }, 200)
    return () => window.clearInterval(id)
  }, [route])

  const close = useCallback(
    (path: string) => {
      const at = tabs.findIndex((t) => t.path === path)
      const rest = tabs.filter((t) => t.path !== path)
      setTabs(rest)
      if (path === route) {
        const next = rest[Math.min(at, rest.length - 1)]
        window.location.hash = `#/${next?.path ?? 'dashboard'}`
      }
    },
    [tabs, route],
  )

  return { tabs, close }
}

export const clearTabs = (uid: string) => {
  try {
    sessionStorage.removeItem(`mosbah-tabs:${uid}`)
  } catch {
    /* ignore */
  }
}
