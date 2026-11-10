import { supabase } from './supabase'

export const MESSAGE_TITLE_MAX = 80
export const MESSAGE_BODY_MAX = 500

/** Sends a message to the chosen accounts (admin only: the database refuses anyone else). Returns how many got it. */
export async function sendMessage(userIds: string[], title: string, body: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('send_message', {
    p_users: userIds,
    p_title: title.trim(),
    p_body: body.trim() || null,
  })
  return error || typeof data !== 'number' ? null : data
}

/** Reminds every owner of the active projects whose balance is under the limit (admin only). Null when it failed. */
export async function sendLowBalanceReminder(): Promise<{ projects: number; owners: number } | null> {
  const { data, error } = await supabase.rpc('send_low_balance_reminder')
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const { projects, owners } = data
  return typeof projects === 'number' && typeof owners === 'number' ? { projects, owners } : null
}
