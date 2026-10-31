import { useCallback, useState, useSyncExternalStore, type FormEvent } from 'react'
import { Pencil, Search as SearchIcon } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import EntryDialog from '../components/EntryDialog'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/format'
import { SEARCH_LIMIT, searchEntries, type Hit } from '../lib/search'
import { useAsync } from '../lib/useAsync'

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const readQuery = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('q')?.trim() ?? ''
const STATUS = { pending: 'معلّق', approved: 'مقبول', rejected: 'مرفوض', deleted: 'محذوف' } as const

export default function Search() {
  const q = useSyncExternalStore(subscribe, readQuery, () => '')
  // a new query (e.g. from the top bar) starts the page fresh
  return <SearchView key={q} q={q} />
}

function SearchView({ q }: { q: string }) {
  const [draft, setDraft] = useState(q)
  const load = useCallback(async () => (q ? searchEntries(q) : { data: [] as Hit[], error: false }), [q])
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
            {rows.length} نتيجة{rows.length >= SEARCH_LIMIT ? ' (أول ' + SEARCH_LIMIT + ' بس، ضيّق البحث)' : ''}
          </p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th className="sm-hide">التاريخ</th>
                  <th className="sm-hide">المشروع</th>
                  <th className="sm-hide">النوع</th>
                  <th className="sm-hide">البند</th>
                  <th>البيان</th>
                  <th className="sm-hide">المقاول</th>
                  <th className="sm-hide">الحالة</th>
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
                      <span className="sub">{dateText(e.entry_date)}</span>
                    </td>
                    <td className="num sm-hide">{dateText(e.entry_date)}</td>
                    <td className="sm-hide">
                      <a href={`#/projects/${e.project_id}`}>{e.project?.name}</a>
                    </td>
                    <td className="sm-hide">
                      {e.kind === 'income' ? 'وارد' : 'مصروف'}
                      {e.advance_id && <span className="muted small"> من عهدة</span>}
                    </td>
                    <td className="sm-hide">{e.category}</td>
                    <td className="strong">
                      {e.item}
                      <span className="sub">
                        {[e.category, e.project?.name, e.contractor?.name].filter(Boolean).join(' · ')}
                      </span>
                      <span className="sub">
                        {e.kind === 'income' ? 'وارد' : 'مصروف'}
                        {e.advance_id ? ' من عهدة' : ''} · {STATUS[e.status]}
                      </span>
                    </td>
                    <td className="sm-hide">{e.contractor?.name}</td>
                    <td className="sm-hide">
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
