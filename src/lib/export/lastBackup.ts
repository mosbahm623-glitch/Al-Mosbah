import { supabase } from '../supabase'

const BACKUP_EVERY_DAYS = 7

export type LastBackup = { at: string | null; stale: boolean }

export async function lastBackup(): Promise<LastBackup | null> {
  const { data, error } = await supabase.from('backup_log').select('at').order('at', { ascending: false }).limit(1)
  if (error) return null
  const at = data?.[0]?.at ?? null
  const days = at ? (Date.now() - new Date(at).getTime()) / 86_400_000 : Infinity
  return { at, stale: days >= BACKUP_EVERY_DAYS }
}
