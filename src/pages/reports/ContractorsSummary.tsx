import { useCallback, useMemo } from 'react'
import TableReport from '../../components/TableReport'
import type { Cell } from '../../lib/tableTypes'
import { money, periodText, todayISO } from '../../lib/format'
import { fetchPaged } from '../../lib/paged'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'
import { toCents } from '../../lib/money'

type Txn = { kind: 'due' | 'payment'; amount: number; txn_date: string; contractor: { name: string } | null }


/** Every contractor on one page: balance before the period, dues, payments and what is left to pay. */
export default function ContractorsSummary({ from, to }: { from: string; to: string }) {
  const load = useCallback(async () => {
    const txns = await fetchPaged<Txn>((a, b) =>
      supabase.from('contractor_transactions').select('kind,amount,txn_date,contractor_id,contractor:contractors(name)').order('id').range(a, b).returns<Txn[]>(),
    )
    return { data: txns, error: !txns }
  }, [])
  const { data, failed } = useAsync<Txn[]>(load)

  const view = useMemo(() => {
    if (!data) return null
    const by = new Map<string, { opening: number; dues: number; paid: number }>()
    for (const t of data) {
      if (to && t.txn_date > to) continue
      const name = t.contractor?.name ?? 'بدون اسم'
      const r = by.get(name) ?? { opening: 0, dues: 0, paid: 0 }
      const c = toCents(t.amount)
      if (from && t.txn_date < from) r.opening += t.kind === 'due' ? c : -c
      else if (t.kind === 'due') r.dues += c
      else r.paid += c
      by.set(name, r)
    }
    const rows = [...by.entries()]
      .map(([name, r]) => ({ name, opening: r.opening / 100, dues: r.dues / 100, paid: r.paid / 100, closing: (r.opening + r.dues - r.paid) / 100 }))
      .filter((r) => r.opening !== 0 || r.dues !== 0 || r.paid !== 0)
      .sort((a, b) => b.closing - a.closing)
    const sum = (k: 'opening' | 'dues' | 'paid' | 'closing') => rows.reduce((s, r) => s + toCents(r[k]), 0) / 100
    return { rows, opening: sum('opening'), dues: sum('dues'), paid: sum('paid'), closing: sum('closing') }
  }, [data, from, to])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الملخص، جرّب تاني</p>
  if (!view) return <p className="muted">جارٍ التحميل...</p>

  return (
    <TableReport
      title="ملخص حسابات المقاولين"
      filename={`المصباح - ملخص المقاولين - ${todayISO()}.xlsx`}
      meta={[{ label: 'الفترة', value: periodText(from, to) }]}
      kpis={[
        { label: 'مستحقات الفترة', value: money(view.dues), tone: 'warn' },
        { label: 'مدفوعات الفترة', value: money(view.paid), tone: 'ok' },
        { label: 'المتبقي لهم', value: money(view.closing), tone: 'err', neg: view.closing < 0 },
        { label: 'عدد المقاولين', value: String(view.rows.length), tone: 'neutral' },
      ]}
      sections={[
        {
          cols: [{ h: 'المقاول' }, { h: 'رصيد قبل الفترة', kind: 'money' }, { h: 'مستحق', kind: 'money' }, { h: 'مدفوع', kind: 'money' }, { h: 'المتبقي', kind: 'money' }],
          rows: view.rows.map((r): Cell[] => [r.name, r.opening, r.dues, r.paid, r.closing]),
          footer: ['الإجمالي', view.opening, view.dues, view.paid, view.closing],
          empty: 'مفيش حسابات مقاولين في الفترة دي.',
        },
      ]}
      note="المتبقي = رصيد قبل الفترة + المستحق − المدفوع، والموجب معناه إن للمقاول فلوس عندنا."
    />
  )
}
