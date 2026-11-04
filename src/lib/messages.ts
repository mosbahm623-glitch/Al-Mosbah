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
