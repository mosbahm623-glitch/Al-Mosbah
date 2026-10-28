import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import { money, todayISO } from '../../lib/format'
import { fetchPaged } from '../../lib/paged'
import { ENTRY_COLUMNS, type Entry } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'

export type PendingStatus = 'pending' | 'rejected' | 'all'
const TITLE: Record<PendingStatus, string> = { pending: 'القيود المعلّقة', rejected: 'القيود المرفوضة', all: 'القيود المعلّقة والمرفوضة' }

/** Entries waiting for an admin's decision, or turned down, with who recorded them. */
export default function PendingReport({ status }: { status: PendingStatus }) {
  const load = useCallback(async () => {
    const wanted = status === 'all' ? ['pending', 'rejected'] : [status]
    const rows = await fetchPaged<Entry>((a, b) =>
      supabase
        .from('entries')
        .select(`${ENTRY_COLUMNS},project:projects(name)`)
        .in('status', wanted)
        .order('created_at')
        .order('id')
        .range(a, b)
        .returns<Entry[]>(),
    )
    return { data: rows, error: rows === null }
  }, [status])
  const { data, failed } = useAsync<Entry[]>(load)

  const view = useMemo(() => {
    const rows = data ?? []
    const sum = (s: Entry['status']) => rows.filter((e) => e.status === s).reduce((t, e) => t + Math.round(e.amount * 100), 0) / 100
    return { rows, pending: rows.filter((e) => e.status === 'pending').length, rejected: rows.filter((e) => e.status === 'rejected').length, pendingTotal: sum('pending') }
  }, [data])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  return (
    <TableReport
      title={TITLE[status]}
      filename={`المصباح - ${TITLE[status]} - ${todayISO()}.xlsx`}
      kpis={[
        { label: 'معلّقة', value: String(view.pending), tone: 'warn' },
        { label: 'إجمالي المعلّق', value: money(view.pendingTotal), tone: 'warn' },
        { label: 'مرفوضة', value: String(view.rejected), tone: 'err' },
      ]}
      sections={[
        {
          cols: [
            { h: 'رقم', kind: 'int' },
            { h: 'التاريخ', kind: 'date' },
            { h: 'المشروع' },
            { h: 'النوع' },
            { h: 'البند' },
            { h: 'البيان' },
            { h: 'سجّله' },
            { h: 'الحالة' },
            { h: 'المبلغ', kind: 'money' },
          ],
          rows: view.rows.map((e) => [
            e.seq,
            e.entry_date,
            e.project?.name ?? null,
            e.kind === 'income' ? 'وارد' : 'مصروف',
            e.category,
            e.item,
            e.creator?.full_name ?? null,
            e.status === 'pending' ? 'معلّق' : 'مرفوض',
            e.amount,
          ]),
          footer: [`عدد القيود: ${view.rows.length}`, ...Array(8).fill(null)],
          empty: 'مفيش قيود بالحالة دي.',
        },
      ]}
      note="القيود المعلّقة مش محسوبة في أي تقرير لحد ما الأدمن يوافق عليها."
    />
  )
}
