import { useEffect, useState } from 'react'
import { looksDuplicated, type VoiceData } from '../../lib/voice/data'
import type { Draft } from '../../lib/voice/drafts'

const keyOf = (d: Draft) => [d.type, d.project, d.custody, d.amount, d.date].join('|')

/** Which cards look like something already saved, or like another card on screen. */
export function useDuplicates(drafts: Draft[], data: VoiceData | null) {
  const [saved, setSaved] = useState<Record<string, boolean>>({})
  const keys = drafts.map(keyOf).join('\n')

  useEffect(() => {
    if (!data) return
    let active = true
    // waits for typing to pause before asking the database
    const timer = setTimeout(() => {
      void Promise.all(drafts.map(async (d) => [keyOf(d), await looksDuplicated(d, data)] as const)).then(
        (found) => active && setSaved(Object.fromEntries(found)),
      )
    }, 400)
    return () => {
      active = false
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `keys` holds everything the check reads from drafts
  }, [keys, data])

  return (d: Draft) =>
    Boolean(d.amount) && (saved[keyOf(d)] || drafts.some((o) => o.id !== d.id && keyOf(o) === keyOf(d)))
}
