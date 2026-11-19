import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react'
import { Search as SearchIcon, X } from 'lucide-react'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/core/format'
import { notifyDataChanged } from '../lib/core/events'
import { useAsync } from '../lib/core/useAsync'
import { invoiceCount } from '../lib/entries/attachments'
import { roomLeft, uploadPicks, type Pick } from '../lib/entries/bulkInvoices'
import { SEARCH_LIMIT, searchEntries, type Hit } from '../lib/entries/search'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
type Picked = { hit: Hit; files: File[] }

/** Admin only: search entries, pick photos for the ones you want, and upload them all at once. */
export default function BulkInvoices() {
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [picked, setPicked] = useState<Record<string, Picked>>({})
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: number; failed: Record<string, number> } | null>(null)

  const load = useCallback(async () => (q ? searchEntries(q) : { data: [] as Hit[], error: false }), [q])
  const { data, failed, loading, reload } = useAsync<Hit[]>(load)

  const rows = (data ?? []).filter((h) => !onlyMissing || invoiceCount(h) === 0 || picked[h.id])
  const list = Object.values(picked)
  const fileCount = list.reduce((n, p) => n + p.files.length, 0)

  function submit(e: FormEvent) {
    e.preventDefault()
    setQ(draft.trim())
  }

  function choose(hit: Hit, e: ChangeEvent<HTMLInputElement>) {
    const files = [...(e.target.files ?? [])].slice(0, roomLeft(invoiceCount(hit)))
    e.target.value = ''
    if (!files.length) return
    setOutcome(null)
    setPicked((p) => ({ ...p, [hit.id]: { hit, files } }))
  }

  const drop = (id: string) =>
    setPicked((p) => {
      const { [id]: _gone, ...rest } = p
      return rest
    })

  async function upload() {
    const picks: Pick[] = list.map((p) => ({ id: p.hit.id, files: p.files, existing: invoiceCount(p.hit) }))
    const result = { ok: 0, failed: {} as Record<string, number> }
    setBusy(true)
    setOutcome(null)
    await uploadPicks(picks, (id, bad) => {
      if (bad === 0) {
        result.ok += 1
        drop(id)
      } else result.failed[id] = bad
    })
    setBusy(false)
    setOutcome(result)
    notifyDataChanged()
    reload()
  }

  return (
    <div className="page-stack">
      <PageHead
        title="رفع فواتير بالجملة"
        note="ابحث عن القيود، اختار صورة (أو أكتر) لكل قيد تحب تربطه، وبعدين ارفع الكل مرة واحدة."
      />

      <form className="toolbar" onSubmit={submit} role="search">
        <label className="search-box">
          <SearchIcon size={18} aria-hidden="true" />
          <input
            type="search"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="رقم القيد أو المبلغ أو البند أو اسم المشروع أو المقاول"
            aria-label="بحث في القيود"
            autoComplete="off"
          />
        </label>
        <button className="btn btn-primary" type="submit">
          بحث
        </button>
        <label className="small">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> من غير
          فاتورة بس
        </label>
      </form>

      {list.length > 0 && (
        <section className="panel" aria-label="القيود المختارة">
          <h2 className="panel-title">
            اخترت {list.length} قيد ({fileCount} ملف)
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {list.map((p) => (
              <li key={p.hit.id}>
                <strong className="num">#{p.hit.seq}</strong> · {p.hit.project?.name} · {money(p.hit.amount)} ·{' '}
                <span className="muted small">{p.files.map((f) => f.name).join('، ')}</span>
                {outcome?.failed[p.hit.id] ? (
                  <span className="msg-error small"> — {outcome.failed[p.hit.id]} ملف ما اترفعش</span>
                ) : null}
                <button
                  type="button"
                  className="icon-btn"
                  aria-label={`شيل القيد ${p.hit.seq} من المختار`}
                  disabled={busy}
                  onClick={() => drop(p.hit.id)}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={() => void upload()}>
            {busy ? 'جارٍ الرفع...' : `ارفع الكل (${list.length} قيد)`}
          </button>
        </section>
      )}

      {outcome && outcome.ok > 0 && <p className="muted">اترفعت فواتير {outcome.ok} قيد وربطناها بيهم.</p>}
      {failed && <p className="msg msg-error">البحث ما نفعش، جرّب تاني</p>}
      {!q && <div className="card empty">اكتب رقم القيد أو المبلغ أو أي كلمة من البند أو اسم المشروع.</div>}
      {q && loading && !data && <p className="muted">جارٍ البحث...</p>}
      {q && data && rows.length === 0 && <div className="card empty">مفيش قيود مطابقة لـ «{q}».</div>}

      {rows.length > 0 && (
        <section className="panel">
          <p className="muted small search-count">
            {rows.length} قيد{(data?.length ?? 0) >= SEARCH_LIMIT ? ` (أول ${SEARCH_LIMIT} بس، ضيّق البحث)` : ''}
          </p>
          <div className="table-wrap">
            <table className="table wrap-desc">
              <thead>
                <tr>
                  <th>رقم</th>
                  <th className="sm-hide">المشروع</th>
                  <th>البند / البيان</th>
                  <th>المبلغ</th>
                  <th className="sm-hide">فواتير</th>
                  <th>
                    <span className="sr-only">اختيار صور</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => {
                  const room = roomLeft(invoiceCount(h))
                  const mine = picked[h.id]
                  return (
                    <tr key={h.id}>
                      <td className="num">
                        {h.seq}
                        <span className="sub">{dateText(h.entry_date)}</span>
                      </td>
                      <td className="sm-hide">{h.project?.name}</td>
                      <td className="strong">
                        {h.item}
                        <span className="sub">
                          {[h.project?.name, h.category, h.contractor?.name].filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="num strong">{money(h.amount)}</td>
                      <td className="num sm-hide">{invoiceCount(h)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {room === 0 ? (
                          <span className="muted small">وصل للحد الأقصى</span>
                        ) : (
                          <label className="btn" style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
                            <input
                              type="file"
                              hidden
                              multiple
                              accept={ACCEPT}
                              disabled={busy}
                              aria-label={`اختيار فواتير القيد ${h.seq}`}
                              onChange={(e) => choose(h, e)}
                            />
                            {mine ? `${mine.files.length} ملف ✓ (غيّر)` : 'اختار صور'}
                          </label>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
