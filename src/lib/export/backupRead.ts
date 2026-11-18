import { supabase } from '../supabase'
import type { Row } from './backupTypes'

type Reader = (
  t: string,
  order: string,
  from: number,
  to: number,
) => PromiseLike<{ data: Row[] | null; error: unknown }>
// table names are dynamic here, so the typed client is bypassed on purpose
export const read: Reader = (t, order, from, to) =>
  (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => ReturnType<Reader> } }
      }
    }
  )
    .from(t)
    .select('*')
    .order(order)
    .range(from, to)
