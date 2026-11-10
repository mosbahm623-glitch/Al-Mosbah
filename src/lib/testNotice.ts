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

export type LowBalanceOverview = { limit: number; owners: number; projects: { name: string; balance: number }[] }

/** The active projects under the limit and how many owners would be told (admin only). Null when it failed. */
export async function fetchLowBalanceOverview(): Promise<LowBalanceOverview | null> {
  const { data, error } = await supabase.rpc('low_balance_overview')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const { limit, owners, projects } = data
  if (typeof limit !== 'number' || typeof owners !== 'number' || !Array.isArray(projects)) return null
  const list = projects.flatMap((p) =>
    p && typeof p === 'object' && !Array.isArray(p) && typeof p.name === 'string' && typeof p.balance === 'number'
      ? [{ name: p.name, balance: p.balance }]
      : [],
  )
  return { limit, owners, projects: list }
}

/** Tells every owner about the projects under the limit (admin only). Null when it failed. */
export async function sendLowBalanceReminder(): Promise<{ projects: number; owners: number } | null> {
  const { data, error } = await supabase.rpc('send_low_balance_reminder')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const { projects, owners } = data
  return typeof projects === 'number' && typeof owners === 'number' ? { projects, owners } : null
}
