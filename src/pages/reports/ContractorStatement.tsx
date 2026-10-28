import { useCallback, useMemo } from 'react'
import TableReport, { type Cell } from '../../components/TableReport'
import { money, periodText, todayISO } from '../../lib/format'
import { fetchPaged } from '../../lib/paged'
import { inRange, runLedger } from '../../lib/reportBuilders'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/useAsync'

type Txn = { id: string; kind: 'due' | 'payment'; amount: number; txn_date: string; notes: string | null; project: { name: string } | null }
type Spent = { id: string; seq: number; category: string; item: string | null; amount: number; entry_date: string; project: { name: string } | null }

const cents = (n: number) => Math.round(n * 100)

/** What we owe one contractor (dues − payments, with a running balance) and what was spent under his name. */
export default function ContractorStatement({ id, name, from, to }: { id: string; name: string; from: string; to: string }) {
  const load = useCallback(async () => {
    const [txns, spent] = await Promise.all([
      fetchPaged<Txn>((a, b) =>
        supabase.from('contractor_transactions').select('id,kind,amount,txn_date,notes,project:projects(name)').eq('contractor_id', id).order('txn_date').order('id').range(a, b).returns<Txn[]>(),
      ),
      fetchPaged<Spent>((a, b) =>
        supabase.from('entries').select('id,seq,category,item,amount,entry_date,project:projects(name)').eq('contractor_id', id).eq('status', 'approved').order('entry_date').order('id').range(a, b).returns<Spent[]>(),
      ),
    ])
    return { data: txns && spent ? { txns, spent } : null, error: !txns || !spent }
  }, [id])
  const { data, failed } = useAsync<{ txns: Txn[]; spent: Spent[] }>(load)

  const view = useMemo(() => {
    if (!data) return null
    const ledger = runLedger(0, data.txns.map((t) => ({ ...t, date: t.txn_date, delta: t.kind === 'due' ? t.amount : -t.amount })), from, to)
    const dues = ledger.rows.filter((r) => r.kind === 'due').reduce((s, r) => s + cents(r.amount), 0) / 100
    const paid = ledger.rows.filter((r) => r.kind === 'payment').reduce((s, r) => s + cents(r.amount), 0) / 100
    const spent = data.spent.filter((e) => inRange(e.entry_date, from, to))
    return { ledger, dues, paid, spent, spentTotal: spent.reduce((s, e) => s + cents(e.amount), 0) / 100 }
  }, [data, from, to])

  if (failed) return <p className="msg msg-error">مقدرناش نحمّل الكشف، جرّب تاني</p>
  if (!view) return <p className="muted">جارٍ التحميل...</p>
  const { ledger, dues, paid, spent, spentTotal } = view

  const ledgerRows: Cell[][] = [
    ...(from ? [[from, 'رصيد قبل الفترة', null, null, null, null, ledger.opening] as Cell[]] : []),
    ...ledger.rows.map((r): Cell[] => [
      r.txn_date,
      r.kind === 'due' ? 'مستحق' : 'دفعة',
      r.project?.name ?? null,
      r.notes,
      r.kind === 'due' ? r.amount : null,
      r.kind === 'payment' ? r.amount : null,
      r.run,
    ]),
  ]

  return (
    <TableReport
      title={`كشف حساب مقاول: ${name}`}
      filename={`المصباح - كشف مقاول ${name} - ${todayISO()}.xlsx`}
      meta={[
        { label: 'المقاول', value: name },
        { label: 'الفترة', value: periodText(from, to) },
      ]}
      kpis={[
        { label: 'مستحقات الفترة', value: money(dues), tone: 'warn' },
        { label: 'مدفوعات الفترة', value: money(paid), tone: 'ok' },
        { label: 'الرصيد الختامي', value: money(ledger.closing), tone: 'neutral', neg: ledger.closing < 0 },
        { label: 'مصروفات مسجلة باسمه', value: money(spentTotal), tone: 'err' },
      ]}
      sections={[
        {
          heading: 'المستحقات والمدفوعات',
          cols: [{ h: 'التاريخ', kind: 'date' }, { h: 'النوع' }, { h: 'المشروع' }, { h: 'ملاحظات' }, { h: 'مستحق', kind: 'money' }, { h: 'مدفوع', kind: 'money' }, { h: 'الرصيد', kind: 'money' }],
          rows: ledgerRows,
          footer: ['الإجمالي', null, null, null, dues, paid, ledger.closing],
          empty: 'مفيش مستحقات أو مدفوعات في الفترة دي.',
        },
        {
          heading: 'المصروفات المسجلة باسم المقاول',
          cols: [{ h: 'رقم', kind: 'int' }, { h: 'التاريخ', kind: 'date' }, { h: 'المشروع' }, { h: 'البند' }, { h: 'البيان' }, { h: 'المبلغ', kind: 'money' }],
          rows: spent.map((e): Cell[] => [e.seq, e.entry_date, e.project?.name ?? null, e.category, e.item, e.amount]),
          footer: ['إجمالي المصروفات المسجلة', null, null, null, null, spentTotal],
          empty: 'مفيش مصروفات مسجلة باسمه في الفترة دي.',
        },
      ]}
      note="الرصيد = المستحق − المدفوع، والرصيد الموجب معناه إن للمقاول فلوس عندنا. المصروفات المسجلة باسمه للعلم بس ومش داخلة في الرصيد."
    />
  )
}
