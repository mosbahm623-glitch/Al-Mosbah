import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import { TYPE_LABEL, money, periodText, todayISO, type ProjectType } from '../../lib/format'
import { fetchPaged } from '../../lib/paged'
import { categoryTotals } from '../../lib/reportBuilders'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { sumMoney } from '../../lib/money'

type Row = { id: string; category: string; amount: number; project: { type: ProjectType } | null }

/** Where the money went: expenses per بند across all projects (including what was paid from custodies). */
export default function CategoryReport({ from, to, type }: { from: string; to: string; type: 'all' | ProjectType }) {
  const load = useCallback(async () => {
    const rows = await fetchPaged<Row>((a, b) => {
      let q = supabase.from('entries').select('id,category,amount,project:projects(type)').eq('kind', 'expense').eq('status', 'approved')
      if (from) q = q.gte('entry_date', from)
      if (to) q = q.lte('entry_date', to)
      return q.order('id').range(a, b).returns<Row[]>()
    })
    return { data: rows, error: rows === null }
  }, [from, to])
  const { data, failed } = useAsync<Row[]>(load)

  const rows = useMemo(() => categoryTotals((data ?? []).filter((r) => type === 'all' || r.project?.type === type)), [data, type])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  const total = sumMoney(rows.map((r) => r.total))
  const count = rows.reduce((s, r) => s + r.count, 0)

  return (
    <TableReport
      title="المصروفات حسب البند"
      filename={`المصباح - مصروفات حسب البند - ${todayISO()}.xlsx`}
      meta={[
        { label: 'الفترة', value: periodText(from, to) },
        { label: 'نوع المشاريع', value: type === 'all' ? 'كل الأنواع' : TYPE_LABEL[type] },
      ]}
      kpis={[
        { label: 'إجمالي المصروفات', value: money(total), tone: 'err' },
        { label: 'عدد البنود', value: String(rows.length), tone: 'neutral' },
        { label: 'أعلى بند', value: rows[0]?.category ?? '—', tone: 'warn' },
      ]}
      sections={[
        {
          cols: [{ h: 'البند' }, { h: 'عدد القيود', kind: 'int' }, { h: 'الإجمالي', kind: 'money' }, { h: 'النسبة' }],
          rows: rows.map((r) => [r.category, r.count, r.total, `${r.share}%`]),
          footer: ['الإجمالي', count, total, rows.length ? '100%' : null],
          empty: 'مفيش مصروفات في الفترة دي.',
        },
      ]}
      note="شامل المصروفات المدفوعة من عهد، لأن المقصود إن الفلوس راحت فين."
    />
  )
}
