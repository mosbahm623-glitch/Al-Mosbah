import { useCallback, useState, type ChangeEvent } from 'react'
import { X } from 'lucide-react'
import PageHead from '../components/PageHead'
import { dateText, money } from '../lib/core/format'
import { notifyDataChanged } from '../lib/core/events'
import { useAsync } from '../lib/core/useAsync'
import { invoiceCount } from '../lib/entries/attachments'
import { roomLeft, uploadPicks, type Pick } from '../lib/entries/bulkInvoices'
import type { Entry } from '../lib/entries/entryTypes'
import { fetchEntries, fetchSummaries, type ProjectSummary } from '../lib/projects/projects'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const SHOW_LIMIT = 300
type Hit = Entry & { projectName: string }
type Picked = { hit: Hit; files: File[] }

/** Admin only: search entries, pick photos for the ones you want, and upload them all at once. */
export default function BulkInvoices() {
  const [projectId, setProjectId] = useState('')
  const [filter, setFilter] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(true)
  const [picked, setPicked] = useState<Record<string, Picked>>({})
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<{ ok: number; failed: Record<string, number> } | null>(null)

  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const projectName = projects.data?.find((p) => p.id === projectId)?.name ?? ''
  const load = useCallback(
    async () => (projectId ? fetchEntries(projectId) : { data: [] as Entry[], error: false }),
    [projectId],
  )
  const { data, failed, loading, reload } = useAsync<Entry[]>(load)

  const needle = filter.trim()
  const matched = (data ?? [])
    .filter((e) => !onlyMissing || invoiceCount(e) === 0 || picked[e.id])
    .filter(
      (e) =>
        !needle ||
        [String(e.seq), String(e.amount), e.item, e.category, e.notes, e.contractor?.name].some((v) =>
          v?.includes(needle),
        ),
    )
  const rows: Hit[] = matched.slice(0, SHOW_LIMIT).map((e) => ({ ...e, projectName }))
  const list = Object.values(picked)
  const fileCount = list.reduce((n, p) => n + p.files.length, 0)

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
        note="اختار المشروع، وبعدين اختار صورة (أو أكتر) لكل قيد تحب تربطه، وارفع الكل مرة واحدة. تقدر تغيّر المشروع وتكمل، واللي اخترته بيفضل."
      />

      <div className="toolbar">
        <label className="small">
          المشروع
          <select
            value={projectId}
            onChange={(e) => {
              setProjectId(e.target.value)
              setFilter('')
            }}
            aria-label="المشروع"
          >
            <option value="">اختار المشروع</option>
            {(projects.data ?? [])
              .slice()
              .sort((x, y) => x.name.localeCompare(y.name, 'ar'))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="تصفية جوه المشروع (رقم أو مبلغ أو بند)"
          aria-label="تصفية القيود"
          autoComplete="off"
          disabled={!projectId}
        />
        <label className="small">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} /> من غير
          فاتورة بس
        </label>
      </div>

      {list.length > 0 && (
        <section className="panel" aria-label="القيود المختارة">
          <h2 className="panel-title">
            اخترت {list.length} قيد ({fileCount} ملف)
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
            {list.map((p) => (
              <li key={p.hit.id}>
                <strong className="num">#{p.hit.seq}</strong> · {p.hit.projectName} · {money(p.hit.amount)} ·{' '}
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
      {(failed || projects.failed) && <p className="msg msg-error">التحميل ما نفعش، جرّب تاني</p>}
      {!projectId && <div className="card empty">اختار المشروع عشان تظهرلك قيوده.</div>}
      {projectId && loading && !data && <p className="muted">جارٍ التحميل...</p>}
      {projectId && data && rows.length === 0 && (
        <div className="card empty">
          {onlyMissing && !needle ? 'كل قيود المشروع ده عليها فواتير.' : 'مفيش قيود مطابقة.'}
        </div>
      )}

      {rows.length > 0 && (
        <section className="panel">
          <p className="muted small search-count">
            {matched.length} قيد{matched.length > SHOW_LIMIT ? ` (معروض أول ${SHOW_LIMIT}، استخدم التصفية)` : ''}
          </p>
          <div className="table-wrap">
            <table className="table wrap-desc">
              <thead>
                <tr>
                  <th>رقم</th>
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
                      <td className="strong">
                        {h.item}
                        <span className="sub">{[h.category, h.contractor?.name].filter(Boolean).join(' · ')}</span>
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
