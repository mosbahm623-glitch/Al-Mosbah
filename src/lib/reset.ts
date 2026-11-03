import { supabase } from './supabase'
import { notifyDataChanged } from './events'
import { isOnline } from './offline/connection'
import { clearReadCache } from './offline/fetch'
import { discardQueued, queueSnapshot } from './offline/queue'

const BUCKET = 'invoices'
const REMOVE_BATCH = 100

/** The word the admin types to confirm. */
export const RESET_WORD = 'مسح'

export type ResetResult = { error: string | null; photosLeft: boolean }

/**
 * Admin only. Wipes every operating record (entries, projects, custodies, banks, contractors, categories, notifications)
 * and restarts the entry numbers; users and their permissions stay. The database refuses anyone but the admin.
 */
export async function resetAllData(): Promise<ResetResult> {
  if (!isOnline()) return { error: 'محتاج إنترنت عشان تعمل إعادة ضبط', photosLeft: false }

  // the photo paths must be read before the rows that point to them are gone
  const paths = await supabase.from('entry_attachments').select('path')
  if (paths.error) return { error: 'حصلت مشكلة، جرّب تاني', photosLeft: false }

  const done = await supabase.rpc('reset_data')
  if (done.error) return { error: 'إعادة الضبط ما اتمتش، ما اتمسحش أي حاجة', photosLeft: false }

  // the data is gone for good: a photo that cannot be removed is hidden anyway (nothing links to it any more)
  let photosLeft = false
  const files = paths.data.map((p) => p.path)
  for (let i = 0; i < files.length; i += REMOVE_BATCH) {
    const removed = await supabase.storage.from(BUCKET).remove(files.slice(i, i + REMOVE_BATCH))
    if (removed.error) photosLeft = true
  }

  // entries waiting on this device point to projects that no longer exist
  for (const q of queueSnapshot()) await discardQueued(q.id)
  await clearReadCache()
  notifyDataChanged()
  return { error: null, photosLeft }
}
