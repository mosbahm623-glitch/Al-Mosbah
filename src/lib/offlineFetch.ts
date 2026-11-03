import { setReachable } from './connection'
import { kvClear, kvGet, kvSet } from './offlineStore'

/**
 * Reads work offline: every successful read from the database is kept on the device, and when the network fails the
 * last copy is served instead. Writes are never kept or replayed here (new entries have their own queue).
 */

/** Database functions that only read. Everything else (edit, delete, restore...) must reach the server. */
const READ_FUNCTIONS = new Set([
  'dashboard_summary',
  'project_summaries',
  'advance_summaries',
  'bank_summaries',
  'bank_movements',
  'deleted_entries',
  'project_deleted_entries',
  'entry_history_of',
])

/** Skip huge answers so the device storage is not filled by one report. */
const MAX_CHARS = 4_000_000

type Stored = { status: number; type: string | null; range: string | null; body: string | null; savedAt: number }

const urlOf = (input: RequestInfo | URL) =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

export function isCacheable(method: string, url: string): boolean {
  let path: string
  try {
    path = new URL(url).pathname
  } catch {
    return false
  }
  if (!path.includes('/rest/v1/')) return false
  if (method === 'GET' || method === 'HEAD') return true
  const fn = method === 'POST' ? /\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path)?.[1] : undefined
  return fn !== undefined && READ_FUNCTIONS.has(fn)
}

/** Who is asking, read from the sign-in token, so one person's copy is never shown to another on the same device. */
function whoIs(headers: Headers): string {
  try {
    const token = (headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      sub?: string
      role?: string
    }
    return payload.role === 'authenticated' && payload.sub ? payload.sub : 'anon'
  } catch {
    return 'anon'
  }
}

function cacheKey(method: string, url: string, headers: Headers, body: string): string {
  return [whoIs(headers), method, url, headers.get('range') ?? '', headers.get('prefer') ?? '', body].join('|')
}

function rebuild(s: Stored): Response {
  const headers = new Headers({ 'x-offline-cache': '1' })
  if (s.type) headers.set('content-type', s.type)
  if (s.range) headers.set('content-range', s.range)
  return new Response(s.status === 204 ? null : s.body, { status: s.status, headers })
}

async function remember(key: string, res: Response) {
  try {
    const body = await res.text()
    if (body.length > MAX_CHARS) return
    const stored: Stored = {
      status: res.status,
      type: res.headers.get('content-type'),
      range: res.headers.get('content-range'),
      body,
      savedAt: Date.now(),
    }
    await kvSet('cache', key, stored)
  } catch {
    /* a failed copy only means no offline copy of this one */
  }
}

/** Wraps `fetch` for the Supabase client. */
export function createOfflineFetch(base: typeof fetch = (...args) => fetch(...args)): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const url = urlOf(input)
    const cacheable = isCacheable(method, url)
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined))
    const key = cacheable ? cacheKey(method, url, headers, typeof init?.body === 'string' ? init.body : '') : ''
    let res: Response
    try {
      res = await base(input, init)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err
      setReachable(false)
      if (cacheable) {
        const hit = await kvGet<Stored>('cache', key)
        if (hit) return rebuild(hit)
      }
      throw err
    }
    setReachable(true)
    if (cacheable && res.ok) void remember(key, res.clone())
    return res
  }
}

/** On sign-out: the copies belong to the person who was signed in. */
export const clearReadCache = () => kvClear('cache')
