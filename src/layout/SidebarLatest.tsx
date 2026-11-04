import { dateText, money } from '../lib/format'
import { KIND_LABEL, direction, fetchMovements, type Movement } from '../lib/movements'
import { useAsync } from '../lib/useAsync'

const TONE = { in: 'tone-text-ok', out: 'tone-text-err', neutral: '' } as const
const SIGN = { in: '+', out: '−', neutral: '' } as const
const LATEST = 10

const loadLatest = async () => {
  const data = await fetchMovements({ latest: LATEST })
  return { data, error: data === null }
}

/** The ten movements recorded most recently, in the sidebar. */
export default function SidebarLatest({ onNavigate }: { onNavigate: () => void }) {
  const { data, failed } = useAsync<Movement[]>(loadLatest)
  return (
    <section className="side-latest" aria-label="آخر القيود">
      <div className="side-latest-head">
        <span className="nav-title">آخر القيود</span>
        <a href="#/recent" className="small" onClick={onNavigate}>
          عرض الكل
        </a>
      </div>
      {failed && <p className="msg msg-error small">مقدرناش نحمّل آخر القيود</p>}
      {data && data.length === 0 && <p className="muted small side-latest-empty">لسه مفيش قيود.</p>}
      {data && data.length > 0 && (
        <ul className="side-latest-list">
          {data.map((m) => (
            <li key={m.key} className="side-latest-item">
              <div className="side-latest-main">
                <span className="side-latest-title">{m.title || m.category || '—'}</span>
                <span className={`num ${TONE[direction(m)]}`}>
                  {SIGN[direction(m)]}
                  {money(m.amount)}
                </span>
              </div>
              <span className="muted small">
                {[dateText(m.date), KIND_LABEL[m.kind], m.project].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
