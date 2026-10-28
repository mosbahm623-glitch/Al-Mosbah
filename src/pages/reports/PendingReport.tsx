import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import { money, todayISO } from '../../lib/format'
import { toCents } from '../../lib/money'
import { fetchEntriesByStatus } from '../../lib/entries'
import type { Entry } from '../../lib/projects'
import { useAsync } from '../../lib/useAsync'

export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'all'
const TITLE: Record<PendingStatus, string> = { pending: 'القيود المعلّقة', approved: 'القيود المقبولة', rejected: 'القيود المرفوضة', all: 'حالة القيود' }

/** Entries waiting for an admin's decision, or turned down, with who recorded them. */
export default function PendingReport({ status, creatorId, creatorName }: { status: PendingStatus; creatorId: string; creatorName: string }) {
  const load = useCallback(
    () => fetchEntriesByStatus(status === 'all' ? ['pending', 'approved', 'rejected'] : [status], creatorId),
    [status, creatorId],
  )
  const { data, failed } = useAsync<Entry[]>(load)

  const view = useMemo(() => {
    const rows = data ?? []
    const sum = (s: Entry['status']) => rows.filter((e) => e.status === s).reduce((t, e) => t + toCents(e.amount), 0) / 100
    const count = (st: Entry['status']) => rows.filter((e) => e.status === st).length
    return { rows, pending: count('pending'), approved: count('approved'), rejected: count('rejected'), pendingTotal: sum('pending'), approvedTotal: sum('approved') }
  }, [data])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  return (
    <TableReport
      title={TITLE[status]}
      meta={creatorName ? [{ label: 'سجّله', value: creatorName }] : undefined}
      filename={`المصباح - ${TITLE[status]} - ${todayISO()}.xlsx`}
      kpis={[
        { label: 'معلّقة', value: String(view.pending), tone: 'warn' },
        { label: 'إجمالي المعلّق', value: money(view.pendingTotal), tone: 'warn' },
        { label: 'مقبولة', value: String(view.approved), tone: 'ok' },
        { label: 'إجمالي المقبول', value: money(view.approvedTotal), tone: 'ok' },
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
            e.status === 'pending' ? 'معلّق' : e.status === 'approved' ? 'مقبول' : 'مرفوض',
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
