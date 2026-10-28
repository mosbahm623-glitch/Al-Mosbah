import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell } from '../../lib/tableTypes'
import { dateText, money } from '../../lib/format'
import { fetchPaged } from '../../lib/paged'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { toCents } from '../../lib/money'

type Decided = {
  id: string; seq: number; kind: 'income' | 'expense'; category: string; item: string | null; amount: number
  entry_date: string; status: 'approved' | 'rejected'; decided_at: string
  project: { name: string } | null; contractor: { name: string } | null
  creator: { full_name: string | null } | null; decider: { full_name: string | null } | null
}

const COLUMNS =
  'id,seq,kind,category,item,amount,entry_date,status,decided_at,project:projects(name),contractor:contractors(name),creator:profiles!entries_created_by_profile_fkey(full_name),decider:profiles!entries_decided_by_fkey(full_name)'

const timeText = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** What was approved or rejected on one day, whatever the date of the entries themselves. */
export default function ApprovalsReport({ day }: { day: string }) {
  const load = useCallback(async () => {
    // the day as the person's own clock sees it
    const from = new Date(`${day}T00:00:00`)
    const to = new Date(from)
    to.setDate(to.getDate() + 1)
    const rows = await fetchPaged<Decided>((a, b) =>
      supabase
        .from('entries')
        .select(COLUMNS)
        .in('status', ['approved', 'rejected'])
        .gte('decided_at', from.toISOString())
        .lt('decided_at', to.toISOString())
        .order('decided_at')
        .order('id')
        .range(a, b)
        .returns<Decided[]>(),
    )
    return { data: rows, error: rows === null }
  }, [day])
  const { data, failed } = useAsync<Decided[]>(load)

  const view = useMemo(() => {
    const rows = data ?? []
    const sum = (f: (e: Decided) => boolean) => rows.filter(f).reduce((t, e) => t + toCents(e.amount), 0) / 100
    const ok = (e: Decided) => e.status === 'approved'
    return {
      rows,
      approved: rows.filter(ok).length,
      rejected: rows.filter((e) => !ok(e)).length,
      income: sum((e) => ok(e) && e.kind === 'income'),
      expense: sum((e) => ok(e) && e.kind === 'expense'),
    }
  }, [data])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل التقرير، جرّب تاني</p>
  if (!data) return <p className="muted">جارٍ التحميل...</p>

  const title = `الموافقات: ${dateText(day)}`
  return (
    <TableReport
      title={title}
      filename={`المصباح - موافقات ${day}.xlsx`}
      meta={[{ label: 'يوم القرار', value: dateText(day) }]}
      kpis={[
        { label: 'اتوافق عليه', value: String(view.approved), tone: 'ok' },
        { label: 'وارد مقبول', value: money(view.income), tone: 'ok' },
        { label: 'مصروف مقبول', value: money(view.expense), tone: 'err' },
        { label: 'اترفض', value: String(view.rejected), tone: 'warn' },
      ]}
      sections={[
        {
          cols: [
            { h: 'الوقت' },
            { h: 'رقم', kind: 'int' },
            { h: 'تاريخ القيد', kind: 'date' },
            { h: 'المشروع' },
            { h: 'النوع' },
            { h: 'البند' },
            { h: 'البيان' },
            { h: 'سجّله' },
            { h: 'القرار' },
            { h: 'بواسطة' },
            { h: 'المبلغ', kind: 'money' },
          ],
          rows: view.rows.map((e): Cell[] => [
            timeText(e.decided_at),
            e.seq,
            e.entry_date,
            e.project?.name ?? null,
            e.kind === 'income' ? 'وارد' : 'مصروف',
            e.category,
            e.item,
            e.creator?.full_name ?? null,
            e.status === 'approved' ? 'موافقة' : 'رفض',
            e.decider?.full_name ?? null,
            e.amount,
          ]),
          footer: [`عدد القرارات: ${view.rows.length}`, ...Array(9).fill(null), null],
          empty: 'مفيش قرارات اتاخدت في اليوم ده.',
        },
      ]}
      note="القيود اللي الأدمن سجّلها بنفسه بتتقبل تلقائي ومش بتظهر هنا، التقرير ده لقرارات الموافقة والرفض بس. لو قيد اتعدّل بعد القرار بيرجع معلّق ويطلع من التقرير لحد ما يتقرر فيه تاني."
    />
  )
}
