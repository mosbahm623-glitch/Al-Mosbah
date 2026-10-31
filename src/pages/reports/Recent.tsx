import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import Segmented from '../../components/Segmented'
import { dateText, money } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { KIND_LABEL, direction, fetchMovements, type Movement, type MovementKind } from '../../lib/movements'

const LIMIT = 50
const GROUPS = [
  { value: 'all', label: 'الكل' },
  { value: 'entries', label: 'وارد ومصروف' },
  { value: 'advances', label: 'العهد' },
  { value: 'contractors', label: 'المقاولين' },
] as const
type Group = (typeof GROUPS)[number]['value']

const KINDS: Record<Group, readonly MovementKind[] | null> = {
  all: null,
  entries: ['income', 'expense'],
  advances: ['installment', 'return'],
  contractors: ['due', 'payment'],
}

const TONE: Record<ReturnType<typeof direction>, string> = { in: 'tone-text-ok', out: 'tone-text-err', neutral: '' }
const SIGN: Record<ReturnType<typeof direction>, string> = { in: '+', out: '−', neutral: '' }

const wrap = async () => {
  const data = await fetchMovements({ latest: LIMIT })
  return { data, error: data === null }
}

const timeText = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const dayText = (iso: string) => dateText(new Date(iso).toLocaleDateString('en-CA'))

export default function Recent() {
  const { data, failed, loading, reload } = useAsync<Movement[]>(wrap)
  const [group, setGroup] = useState<Group>('all')

  const rows = useMemo(() => {
    const kinds = KINDS[group]
    return (data ?? []).filter((m) => !kinds || kinds.includes(m.kind))
  }, [data, group])

  return (
    <div className="page-stack">
      <PageHead
        title="آخر التحركات"
        note={`آخر ${LIMIT} حركة اتسجلت، الأحدث الأول. القيود المعلّقة بتظهر هنا وعليها علامة.`}
        actions={
          <button className="btn" onClick={reload} disabled={loading}>
            {loading ? 'جارٍ التحديث...' : 'تحديث'}
          </button>
        }
      />
      <div className="toolbar">
        <Segmented label="النوع" value={group} options={GROUPS} onChange={setGroup} />
        <span className="toolbar-note muted small">{rows.length} حركة</span>
      </div>

      {failed && <p className="msg msg-error">مقدرناش نحمّل الحركات، جرّب تاني</p>}
      {loading && !data && <p className="muted">جارٍ التحميل...</p>}
      {data && rows.length === 0 && <div className="card empty">مفيش حركات.</div>}

      {rows.length > 0 && (
        <section className="panel">
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th className="sm-hide">اتسجل</th>
                  <th className="sm-hide">التاريخ</th>
                  <th>النوع</th>
                  <th className="sm-hide">البند</th>
                  <th>البيان</th>
                  <th className="sm-hide">المشروع</th>
                  <th className="sm-hide">المقاول / العهدة</th>
                  <th>المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => {
                  const dir = direction(m)
                  return (
                    <tr key={m.key}>
                      <td className="num muted small sm-hide">
                        {dayText(m.at)} {timeText(m.at)}
                      </td>
                      <td className="num sm-hide">{dateText(m.date)}</td>
                      <td>
                        <span className="chip chip-neutral">{KIND_LABEL[m.kind]}</span>
                        {m.fromAdvance && <span className="muted small"> من عهدة</span>}
                        {m.status === 'pending' && <span className="chip chip-warn">معلّق</span>}
                        {m.status === 'rejected' && <span className="chip chip-err">مرفوض</span>}
                      </td>
                      <td className="sm-hide">{m.category}</td>
                      <td className="strong">
                        {m.title}
                        <span className="sub">{dateText(m.date)}</span>
                        <span className="sub">{[m.category, m.project, m.party].filter(Boolean).join(' · ')}</span>
                        <span className="sub">
                          اتسجل {dayText(m.at)} {timeText(m.at)}
                        </span>
                      </td>
                      <td className="sm-hide">{m.project}</td>
                      <td className="sm-hide">{m.party}</td>
                      <td className={`num strong ${TONE[dir]}`}>
                        {SIGN[dir]}
                        {money(m.amount)}
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
