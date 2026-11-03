import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'

/**
 * The sign-in the browser kept on this device. When the token has expired and there is no network to renew it, the
 * client reports "no session"; the stored copy lets the person keep working from the saved data. Once the network is
 * back the client renews the token by itself. The server still decides what the person may do.
 */
export function readStoredSession(): Session | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !/^sb-.+-auth-token$/.test(k)) continue
      const s = JSON.parse(localStorage.getItem(k) ?? 'null') as Session | null
      if (s?.user?.id && s.refresh_token) return s
    }
  } catch {
    /* no storage: nothing to restore */
  }
  return null
}

/** Who is signed in, also while offline with an expired token. Null when nobody is. */
export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user.id ?? readStoredSession()?.user.id ?? null
}
