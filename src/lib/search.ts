import { supabase } from './supabase'
import { ENTRY_COLUMNS, type Entry } from './projects'

export type Hit = Entry & { project_id: string; project: { name: string } | null }

const SELECT = `${ENTRY_COLUMNS},project_id,project:projects(name)`
export const SEARCH_LIMIT = 100
// % _ and , have a meaning inside a PostgREST filter
const clean = (q: string) => q.replace(/[%_,()*\\]/g, ' ').trim()

/** Entries by number, البند, البيان, project or contractor name. */
export async function searchEntries(q: string) {
  const like = `%${clean(q)}%`
  const num = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null
  const byText = supabase
    .from('entries')
    .select(SELECT)
    .or(`category.ilike.${like},item.ilike.${like},notes.ilike.${like}`)
    .limit(SEARCH_LIMIT)
    .returns<Hit[]>()
  const [text, projects, contractors, seq] = await Promise.all([
    byText,
    supabase.from('projects').select('id').ilike('name', like).limit(50),
    supabase.from('contractors').select('id').ilike('name', like).limit(50),
    num !== null && num <= 2147483647
      ? supabase.from('entries').select(SELECT).eq('seq', num).returns<Hit[]>()
      : Promise.resolve({ data: [] as Hit[], error: null }),
  ])
  if (text.error || projects.error || contractors.error || seq.error) return { data: null, error: true }
  const projectIds = (projects.data ?? []).map((p) => p.id)
  const contractorIds = (contractors.data ?? []).map((c) => c.id)
  const [byProject, byContractor] = await Promise.all([
    projectIds.length
      ? supabase.from('entries').select(SELECT).in('project_id', projectIds).limit(SEARCH_LIMIT).returns<Hit[]>()
      : Promise.resolve({ data: [] as Hit[], error: null }),
    contractorIds.length
      ? supabase.from('entries').select(SELECT).in('contractor_id', contractorIds).limit(SEARCH_LIMIT).returns<Hit[]>()
      : Promise.resolve({ data: [] as Hit[], error: null }),
  ])
  if (byProject.error || byContractor.error) return { data: null, error: true }
  const merged = new Map<string, Hit>()
  // a number match comes first, then the rest, newest number first
  for (const h of [...(seq.data ?? []), ...(text.data ?? []), ...(byProject.data ?? []), ...(byContractor.data ?? [])])
    merged.set(h.id, h)
  const seqFirst = (h: Hit) => (h.seq === num ? 1 : 0)
  return { data: [...merged.values()].sort((a, b) => seqFirst(b) - seqFirst(a) || b.seq - a.seq), error: false }
}
