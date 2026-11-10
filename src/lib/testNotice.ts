import { supabase } from './supabase'

/**
 * Sends the test notification to the chosen accounts, or to every active account when `userIds` is null
 * (admin only: the database refuses anyone else). Returns how many accounts got it, or null when it failed.
 */
export async function sendTestNotification(userIds: string[] | null): Promise<number | null> {
  const { data, error } = await supabase.rpc('send_test_notification', { p_users: userIds })
  return error || typeof data !== 'number' ? null : data
}

/** How many phones / browsers each account registered for notifications (admin only). Null when it failed. */
export async function fetchPushDevices(): Promise<Record<string, number> | null> {
  const { data, error } = await supabase.rpc('push_devices')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const out: Record<string, number> = {}
  for (const [id, n] of Object.entries(data)) if (typeof n === 'number') out[id] = n
  return out
}
