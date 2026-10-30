import { useCallback, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Pencil, Search as SearchIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import EntryDialog from '../components/EntryDialog'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/format'
import { ENTRY_COLUMNS, type Entry } from '../lib/projects'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/useAsync'

type Hit = Entry & { project_id: string; project: { name: string } | null }

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const readQuery = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('q')?.trim() ?? ''

const SELECT = `${ENTRY_COLUMNS},project_id,project:projects(name)`
const LIMIT = 100
// % _ and , have a meaning inside a PostgREST filter
const clean = (q: string) => q.replace(/[%_,()*\\]/g, ' ').trim()
const STATUS = { pending: 'معلّق', approved: 'مقبول', rejected: 'مرفوض', deleted: 'محذوف' } as const

/** Entries by number, البند, البيان, project or contractor name. */
async function search(q: string) {
  const like = `%${clean(q)}%`
  const num = /^#?\d+$/.test(q) ? Number(q.replace('#', '')) : null
  const byText = supabase
    .from('entries')
    .select(SELECT)
    .or(`category.ilike.${like},item.ilike.${like},notes.ilike.${like}`)
    .limit(LIMIT)
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
      ? supabase.from('entries').select(SELECT).in('project_id', projectIds).limit(LIMIT).returns<Hit[]>()
      : Promise.resolve({ data: [] as Hit[], error: null }),
    contractorIds.length
      ? supabase.from('entries').select(SELECT).in('contractor_id', contractorIds).limit(LIMIT).returns<Hit[]>()
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

export default function Search() {
  const q = useSyncExternalStore(subscribe, readQuery, () => '')
  // a new query (e.g. from the top bar) starts the page fresh
  return <SearchView key={q} q={q} />
}

function SearchView({ q }: { q: string }) {
  const [draft, setDraft] = useState(q)
  const load = useCallback(async () => (q ? search(q) : { data: [] as Hit[], error: false }), [q])
  const { data, failed, loading, reload } = useAsync<Hit[]>(load)
  const { can, isStaff: isAdmin } = useAuth()
  const canEdit = can('projects', 'edit')
  const [editing, setEditing] = useState<Hit | null>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = draft.trim()
    window.location.hash = `#/search${v ? `?q=${encodeURIComponent(v)}` : ''}`
  }

  const rows = data ?? []
  return (
    <div className="page-stack">
      <PageHead title="بحث في القيود" note="ابحث برقم القيد أو البند أو البيان أو اسم المشروع أو المقاول." />
      <form className="toolbar" onSubmit={submit} role="search">
        <label className="search-box">
          <SearchIcon size={18} aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثلاً: 413 أو كهرباء أو اسم مقاول"
            aria-label="بحث في القيود"
            autoComplete="off"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          بحث
        </button>
      </form>

      {failed && <p className="msg msg-error">البحث ما نفعش، جرّب تاني</p>}
      {!q && <div className="card empty">اكتب رقم القيد أو أي كلمة من البند أو البيان.</div>}
      {q && loading && !data && <p className="muted">جارٍ البحث...</p>}
      {q && data && rows.length === 0 && <div className="card empty">مفيش نتايج لـ «{q}».</div>}

      {rows.length > 0 && (
        <section className="panel">
          <p className="muted small search-count">
            {rows.length} نتيجة{rows.length >= LIMIT ? ' (أول ' + LIMIT + ' بس، ضيّق البحث)' : ''}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th>التاريخ</th>
                  <th>المشروع</th>
                  <th>النوع</th>
                  <th>البند</th>
                  <th>البيان</th>
                  <th>المقاول</th>
                  <th>الحالة</th>
                  <th>المبلغ</th>
                  {canEdit && (
                    <th>
                      <span className="sr-only">إجراءات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="num">
                      <a href={`#/projects/${e.project_id}`}>{e.seq}</a>
                    </td>
                    <td className="num">{dateText(e.entry_date)}</td>
                    <td>
                      <a href={`#/projects/${e.project_id}`}>{e.project?.name}</a>
                    </td>
                    <td>
                      {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      {e.advance_id && <span className="muted small"> من عهدة</span>}
                    </td>
                    <td>{e.category}</td>
                    <td className="strong">{e.item}</td>
                    <td>{e.contractor?.name}</td>
                    <td>
                      <span
                        className={`chip ${e.status === 'approved' ? 'chip-neutral' : e.status === 'pending' ? 'chip-warn' : 'chip-err'}`}
                      >
                        {STATUS[e.status]}
                      </span>
                    </td>
                    <td className="num strong">{money(e.amount)}</td>
                    {canEdit && (
                      <td>
                        {(isAdmin || e.status !== 'approved') && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`تعديل أو مسح القيد ${e.seq}`}
                            title="تعديل / مسح"
                            onClick={() => setEditing(e)}
                          >
                            <Pencil size={17} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <EntryDialog
          projectId={editing.project_id}
          projectName={editing.project?.name ?? ''}
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
