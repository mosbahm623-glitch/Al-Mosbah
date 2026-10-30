/** A chainable stand-in for a Supabase query: records every call and resolves to `result` when awaited. */
type Call = [method: string, args: unknown[]]

export function query(result: unknown) {
  const calls: Call[] = []
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result).then(ok, bad)
        }
        return (...args: unknown[]) => {
          calls.push([String(prop), args])
          return proxy
        }
      },
    },
  )
  return { query: proxy as never, calls }
}

/** One recorded `from(table)` use. */
export type Recorded = { table: string; calls: Call[] }
