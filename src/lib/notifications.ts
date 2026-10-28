import { supabase } from './supabase'

export type Notice = { id: number; kind: string; title: string; body: string | null; url: string | null; created_at: string; read_at: string | null }

export const fetchNotices = () =>
  supabase.from('notifications').select('id,kind,title,body,url,created_at,read_at').order('created_at', { ascending: false }).limit(100).returns<Notice[]>()

export async function countUnread() {
  const { count } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null)
  return count ?? 0
}

export const markRead = (id: number) => supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).is('read_at', null)
export const markAllRead = () => supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
export const clearAll = () => supabase.from('notifications').delete().gte('id', 0)
