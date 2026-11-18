import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import Segmented from '../../components/Segmented'
import { dateText, money } from '../../lib/core/format'
import {
  extraAmount,
  fetchDuplicateGroups,
  isConsecutivePair,
  summarizeDuplicates,
  type DuplicateGroup,
} from '../../lib/entries/duplicates'
import { useAsync } from '../../lib/core/useAsync'

const KINDS = [
  { value: 'all', label: 'الكل' },
  { value: 'income', label: 'وارد' },
  { value: 'expense', label: 'مصروف' },
  { value: 'close', label: 'أرقام متتالية' },
] as const
type Kind = (typeof KINDS)[number]['value']

const matches = (g: DuplicateGroup, kind: Kind) =>
  kind === 'all' || (kind === 'close' ? isConsecutivePair(g) : g.kind === kind)

/** Admin only: entries with the same day, البيان, project and amount. A hint to review, not proof of a mistake. */
export default function Duplicates() {
  const { data, failed, loading, reload } = useAsync<DuplicateGroup[]>(fetchDuplicateGroups)
  const [kind, setKind] = useState<Kind>('all')
  const rows = useMemo(() => (data ?? []).filter((g) => matches(g, kind)), [data, kind])
  const s = useMemo(() => summarizeDuplicates(rows), [rows])

  return (
    <div className="page-stack">
      <PageHead
        title="قيود متطابقة"
        note="نفس اليوم ونفس البيان ونفس المشروع ونفس المبلغ. مش كل تكرار غلط: الإكراميات ونقلات الرتش بتتكرر فعلاً."
        actions={
          <button className="btn" onClick={reload} disabled={loading}>
            {loading ? 'جارٍ التحديث...' : 'تحديث'}
          </button>
        }
      />
      <div className="toolbar">
        <Segmented label="النوع" value={kind} options={KINDS} onChange={setKind} />
        <span className="toolbar-note muted small">
          {s.groups} مجموعة · {s.extraEntries} قيد زيادة · وارد {money(s.extraIncome)} · مصروف {money(s.extraExpense)}
        </span>
      </div>
      {failed && <p className="msg msg-error">مقدرناش نحمّل القيود، جرّب تاني</p>}
      {data && rows.length === 0 && <div className="card empty">مفيش قيود متطابقة.</div>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>البيان</th>
                <th>المشروع</th>
                <th>المبلغ</th>
                <th>العدد</th>
                <th>الزيادة</th>
                <th>أرقام القيود</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={`${g.entry_date}-${g.kind}-${g.amount}-${g.entries[0].seq}`}>
                  <td className="num muted">{dateText(g.entry_date)}</td>
                  <td className="strong">
                    {g.kind === 'income' ? g.category || g.item : `${g.category} · ${g.item ?? ''}`}
                    <span className="sub">
                      <span className={`chip ${g.kind === 'income' ? 'chip-ok' : 'chip-err'}`}>
                        {g.kind === 'income' ? 'وارد' : 'مصروف'}
                      </span>
                      {isConsecutivePair(g) && <span className="chip chip-warn"> متتالية</span>}
                    </span>
                  </td>
                  <td>{g.project ?? '—'}</td>
                  <td className="num">{money(g.amount)}</td>
                  <td className="num">{g.n}</td>
                  <td className="num strong">{money(extraAmount(g))}</td>
                  <td className="num small">{g.entries.map((e) => e.seq).join(' ، ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
