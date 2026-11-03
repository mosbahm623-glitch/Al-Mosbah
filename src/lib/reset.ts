import { supabase } from './supabase'
import { notifyDataChanged } from './events'
import { isOnline } from './offline/connection'
import { clearReadCache } from './offline/fetch'
import { discardQueued, queueSnapshot } from './offline/queue'

const BUCKET = 'invoices'
const REMOVE_BATCH = 100

/** The word the admin types to confirm. */
export const RESET_WORD = 'مسح'

export type ResetGroupId =
  | 'entries'
  | 'contractor_dues'
  | 'projects'
  | 'contractors'
  | 'advances'
  | 'banks'
  | 'categories'
  | 'notifications'
  | 'users'

export type ResetGroup = { id: ResetGroupId; label: string; hint: string; requires: ResetGroupId[] }

/**
 * What the admin can wipe. A group that other records point at cannot go alone: `requires` lists what must go with it
 * (the database refuses a selection that leaves them out, so this list only has to show it).
 */
export const RESET_GROUPS: ResetGroup[] = [
  { id: 'entries', label: 'القيود', hint: 'وصور الفواتير وتاريخ التعديلات وترقيم القيود', requires: [] },
  { id: 'contractor_dues', label: 'مستحقات المقاولين', hint: 'الحركات والتسويات (أسماء المقاولين لا)', requires: [] },
  { id: 'projects', label: 'المشاريع', hint: 'بميزانياتها', requires: ['entries', 'contractor_dues'] },
  {
    id: 'contractors',
    label: 'أسماء المقاولين',
    hint: 'قايمة المقاولين نفسها',
    requires: ['entries', 'contractor_dues'],
  },
  { id: 'advances', label: 'العهد', hint: 'بدفعاتها ومرتجعاتها ووصول المستخدمين ليها', requires: ['entries'] },
  { id: 'banks', label: 'البنوك', hint: 'الحسابات البنكية', requires: ['entries'] },
  { id: 'categories', label: 'البنود', hint: 'البنود وبيانات كل بند', requires: [] },
  { id: 'notifications', label: 'الإشعارات', hint: 'كل إشعارات المستخدمين', requires: [] },
  {
    id: 'users',
    label: 'باقي المستخدمين',
    hint: 'كل الحسابات ماعدا حسابك، وبتتقفل ومحدش منهم يقدر يسجّل تاني بنفسه',
    requires: ['entries', 'contractor_dues', 'advances'],
  },
]

const BY_ID = new Map(RESET_GROUPS.map((g) => [g.id, g]))

/** Everything that goes with the picked groups (the picked ones and whatever they need). */
export function withRequired(picked: Iterable<ResetGroupId>): Set<ResetGroupId> {
  const all = new Set<ResetGroupId>()
  for (const id of picked) {
    all.add(id)
    for (const need of BY_ID.get(id)?.requires ?? []) all.add(need)
  }
  return all
}

/** Every group except the users: the whole operating data, as before. */
export const ALL_DATA_GROUPS = RESET_GROUPS.filter((g) => g.id !== 'users').map((g) => g.id)

export type ResetResult = { error: string | null; photosLeft: boolean }

/**
 * Admin only. Wipes the chosen groups (see RESET_GROUPS) and restarts the entry numbers when the entries go.
 * The database refuses anyone but the admin, and a selection that leaves out something the chosen groups need.
 */
export async function resetData(groups: ResetGroupId[]): Promise<ResetResult> {
  if (!isOnline()) return { error: 'محتاج إنترنت عشان تعمل إعادة ضبط', photosLeft: false }
  const chosen = withRequired(groups)
  if (chosen.size === 0) return { error: 'اختار حاجة واحدة على الأقل', photosLeft: false }

  // the photo paths must be read before the rows that point to them are gone
  let files: string[] = []
  if (chosen.has('entries')) {
    const paths = await supabase.from('entry_attachments').select('path')
    if (paths.error) return { error: 'حصلت مشكلة، جرّب تاني', photosLeft: false }
    files = paths.data.map((p) => p.path)
  }

  const done = await supabase.rpc('reset_data', { p_groups: [...chosen] })
  if (done.error) return { error: 'إعادة الضبط ما اتمتش، ما اتمسحش أي حاجة', photosLeft: false }

  // the data is gone for good: a photo that cannot be removed is hidden anyway (nothing links to it any more)
  let photosLeft = false
  for (let i = 0; i < files.length; i += REMOVE_BATCH) {
    const removed = await supabase.storage.from(BUCKET).remove(files.slice(i, i + REMOVE_BATCH))
    if (removed.error) photosLeft = true
  }

  // entries waiting on this device point to records that may no longer exist
  if (chosen.has('entries')) for (const q of queueSnapshot()) await discardQueued(q.id)
  await clearReadCache()
  notifyDataChanged()
  return { error: null, photosLeft }
}
