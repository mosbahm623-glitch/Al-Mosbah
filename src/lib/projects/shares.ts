import { supabase } from '../supabase'

/** A client link to one project: read-only, no sign-in, and the office can cancel it any time. */
export type ProjectShare = {
  id: string
  token: string
  created_at: string
  expires_at: string | null
  /** what the client sees besides the statement: the entry number and the date (both off unless the office ticks them) */
  show_seq: boolean
  show_date: boolean
}

const SHARE_COLUMNS = 'id, token, created_at, expires_at, show_seq, show_date'

type SharedEntry = {
  seq: number
  entry_date: string
  kind: 'income' | 'expense'
  category: string
  item: string | null
  amount: number
  /** how many invoice files the entry has (the files themselves come from `fetchShareFiles`) */
  files: number
}

/** What the client sees. The database sends only these fields: no contractor, bank, who recorded it, or notes. */
export type SharedProject = {
  name: string
  status: 'active' | 'closed'
  show_seq: boolean
  show_date: boolean
  income: number
  expenses: number
  categories: { category: string; total: number }[]
  entries: SharedEntry[]
}

const TOKEN = /^share\/([0-9a-f]{64})$/

/** The link token when the route is a client link (#/share/<token>), otherwise null. */
export const shareTokenOf = (route: string) => TOKEN.exec(route)?.[1] ?? null

/** The full address to send the client: its own page (client.html) so the preview says it is a client link. Hash routing, so it works on GitHub Pages as it is. */
export const shareUrl = (token: string) =>
  `${window.location.origin}${import.meta.env.BASE_URL}client.html#/share/${token}`

/** The project's live link (the newest one that is neither cancelled nor expired), or null. */
export async function fetchActiveShare(projectId: string): Promise<{ data: ProjectShare | null; error: boolean }> {
  const { data, error } = await supabase
    .from('project_shares')
    .select(SHARE_COLUMNS)
    .eq('project_id', projectId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .returns<ProjectShare[]>()
  if (error || !data) return { data: null, error: true }
  const now = Date.now()
  return { data: data.find((s) => !s.expires_at || new Date(s.expires_at).getTime() > now) ?? null, error: false }
}

export const createShare = (projectId: string) =>
  supabase.from('project_shares').insert({ project_id: projectId }).select(SHARE_COLUMNS).single()

/** What the link shows the client: the entry number and/or the date. */
export const updateShareOptions = (id: string, options: { show_seq?: boolean; show_date?: boolean }) =>
  supabase.from('project_shares').update(options).eq('id', id)

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

export type ShareFile = { url: string; name: string | null; pdf: boolean }

/** The invoice files of one entry, as ten-minute links. The `share-files` edge function checks the link first. */
export async function fetchShareFiles(token: string, seq: number): Promise<ShareFile[] | null> {
  const { data, error } = await supabase.functions.invoke<{ files?: ShareFile[] }>('share-files', {
    body: { token, seq },
  })
  return error || !data?.files ? null : data.files
}
