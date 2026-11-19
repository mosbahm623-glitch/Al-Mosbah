import { supabase } from '../supabase'

/** A client link to one project: read-only, no sign-in, and the office can cancel it any time. */
export type ProjectShare = { id: string; token: string; created_at: string; expires_at: string | null }

type SharedEntry = {
  seq: number
  entry_date: string
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
}

/** What the client sees. The database sends only these fields: no contractor, bank, who recorded it, or notes. */
export type SharedProject = {
  name: string
  status: 'active' | 'closed'
  income: number
  expenses: number
  categories: { category: string; total: number }[]
  entries: SharedEntry[]
}

const TOKEN = /^share\/([0-9a-f]{64})$/

/** The link token when the route is a client link (#/share/<token>), otherwise null. */
export const shareTokenOf = (route: string) => TOKEN.exec(route)?.[1] ?? null

/** The full address to send the client. Hash routing, so it works on GitHub Pages as it is. */
export const shareUrl = (token: string) => `${window.location.origin}${window.location.pathname}#/share/${token}`

/** The project's live link (the newest one that is neither cancelled nor expired), or null. */
export async function fetchActiveShare(projectId: string): Promise<{ data: ProjectShare | null; error: boolean }> {
  const { data, error } = await supabase
    .from('project_shares')
    .select('id, token, created_at, expires_at')
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .returns<ProjectShare[]>()
  if (error || !data) return { data: null, error: true }
  const now = Date.now()
  return { data: data.find((s) => !s.expires_at || new Date(s.expires_at).getTime() > now) ?? null, error: false }
}

export const createShare = (projectId: string) =>
  supabase.from('project_shares').insert({ project_id: projectId }).select('id, token, created_at, expires_at').single()

/** Cancels every live link of the project: the old address stops working at once. */
export const revokeShares = (projectId: string) =>
  supabase
    .from('project_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .is('revoked_at', null)

/** The client page's data. `null` data with no error means the link is wrong, cancelled or expired. */
export const fetchSharedProject = (token: string) =>
  supabase.rpc('shared_project', { p_token: token }).returns<SharedProject | null>()
