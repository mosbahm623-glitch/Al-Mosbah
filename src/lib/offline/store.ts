/**
 * A small key-value store on top of IndexedDB (it keeps big values and photos). Where IndexedDB is missing or blocked
 * (tests, some private windows) it falls back to memory, so callers never need to care.
 */
export type StoreName = 'cache' | 'queue'

const DB_NAME = 'mosbah-offline'
const NAMES: StoreName[] = ['cache', 'queue']
const memory: Record<StoreName, Map<string, unknown>> = { cache: new Map(), queue: new Map() }
let opening: Promise<IDBDatabase | null> | undefined

function openDb(): Promise<IDBDatabase | null> {
  opening ??= new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null)
    try {
      const req = indexedDB.open(DB_NAME, 1)
      req.onupgradeneeded = () => {
        for (const n of NAMES) req.result.createObjectStore(n)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
      req.onblocked = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
  return opening
}

async function withStore<T>(
  name: StoreName,
  mode: IDBTransactionMode,
  use: (store: IDBObjectStore) => IDBRequest<T>,
  fallback: (map: Map<string, unknown>) => T,
): Promise<T> {
  const db = await openDb()
  if (!db) return fallback(memory[name])
  return new Promise<T>((resolve) => {
    try {
      const req = use(db.transaction(name, mode).objectStore(name))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(fallback(memory[name]))
    } catch {
      resolve(fallback(memory[name]))
    }
  })
}

export const kvGet = <T>(name: StoreName, key: string) =>
  withStore<T | undefined>(
    name,
    'readonly',
    (s) => s.get(key) as IDBRequest<T | undefined>,
    (m) => m.get(key) as T | undefined,
  )

export const kvSet = (name: StoreName, key: string, value: unknown) =>
  withStore<unknown>(
    name,
    'readwrite',
    (s) => s.put(value, key) as IDBRequest<unknown>,
    (m) => void m.set(key, value),
  )

export const kvDelete = (name: StoreName, key: string) =>
  withStore<unknown>(
    name,
    'readwrite',
    (s) => s.delete(key) as IDBRequest<unknown>,
    (m) => void m.delete(key),
  )

export const kvValues = <T>(name: StoreName) =>
  withStore<T[]>(
    name,
    'readonly',
    (s) => s.getAll() as IDBRequest<T[]>,
    (m) => [...m.values()] as T[],
  )

export const kvClear = (name: StoreName) =>
  withStore<unknown>(
    name,
    'readwrite',
    (s) => s.clear() as IDBRequest<unknown>,
    (m) => void m.clear(),
  )
