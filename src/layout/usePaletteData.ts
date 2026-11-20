import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { fetchAdvanceSummaries } from '../lib/advances/advances'
import { fetchBankSummaries } from '../lib/banks/banks'
import { fetchContractorSummaries } from '../lib/contractors/contractors'
import { TYPE_LABEL } from '../lib/core/format'
import { fetchSummaries } from '../lib/projects/projects'

export type Place = {
  group: 'projects' | 'advances' | 'contractors' | 'banks'
  label: string
  meta?: string
  path: string
}

/** The rows of a lookup, or none when it fails (the quick search just leaves that group out). */
async function rows<T>(lookup: PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  try {
    return (await lookup).data ?? []
  } catch {
    return []
  }
}

/** The names the quick search can jump to (loaded when it opens, kept for a minute). Whatever a person may not see is left out. */
export function usePaletteData() {
  const { can } = useAuth()
  const [places, setPlaces] = useState<Place[]>([])

  useEffect(() => {
    let live = true
    void (async () => {
      const [projects, advances, contractors, banks] = await Promise.all([
        can('projects') ? rows(fetchSummaries()) : [],
        can('advances') ? rows(fetchAdvanceSummaries()) : [],
        can('contractors') ? rows(fetchContractorSummaries()) : [],
        can('banks') ? rows(fetchBankSummaries()) : [],
      ])
      if (!live) return
      setPlaces([
        ...projects.map((p) => ({
          group: 'projects' as const,
          label: p.name,
          meta: [TYPE_LABEL[p.type], p.status === 'closed' ? 'مقفول' : ''].filter(Boolean).join(' · '),
          path: `projects/${p.id}`,
        })),
        ...advances.map((a) => ({
          group: 'advances' as const,
          label: a.holder_name,
          meta: a.status === 'open' ? 'مفتوحة' : 'مقفولة',
          path: `advances/${a.id}`,
        })),
        ...contractors.map((c) => ({ group: 'contractors' as const, label: c.name, path: `contractors/${c.id}` })),
        ...banks.map((b) => ({ group: 'banks' as const, label: b.name, path: `banks/${b.id}` })),
      ])
    })()
    return () => {
      live = false
    }
  }, [can])

  return places
}
