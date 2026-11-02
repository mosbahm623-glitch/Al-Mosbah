import { useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Wallet } from 'lucide-react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { useAuth } from '../../auth/AuthProvider'
import { fetchContractorLedger, type LedgerTxn, type Spent } from '../../lib/contractors'
import { dateText, money } from '../../lib/format'
import { fetchContractorNames, fetchProjectNames, type Named } from '../../lib/lookups'
import { toCents } from '../../lib/money'
import { useAsync } from '../../lib/useAsync'
import TxnDialog from './TxnDialog'

type Dialog = { kind: 'due' | 'payment'; row?: LedgerTxn } | null

/** One contractor: what we owe him per project, and every due and payment with a running balance. */
export default function ContractorDetail({ id }: { id: string }) {
  const { can } = useAuth()
  const canEdit = can('contractors', 'edit')
  const names = useAsync<Named[]>(fetchContractorNames)
  const projects = useAsync<Named[]>(fetchProjectNames)
  const ledger = useAsync<{ txns: LedgerTxn[]; spent: Spent[] }>(
    useCallback(async () => {
      const data = await fetchContractorLedger(id)
      return { data, error: data === null }
    }, [id]),
  )
  const [project, setProject] = useState('')
  const [dialog, setDialog] = useState<Dialog>(null)
  const name = names.data?.find((c) => c.id === id)?.name

  const view = useMemo(() => {
    const txns = (ledger.data?.txns ?? []).filter((t) => !project || (t.project_id ?? 'none') === project)
    const lines = txns.map((t, i) => ({
      t,
      run: txns.slice(0, i + 1).reduce((sum, x) => sum + toCents(x.kind === 'due' ? x.amount : -x.amount), 0) / 100,
    }))
    const due = txns.filter((t) => t.kind === 'due').reduce((s, t) => s + toCents(t.amount), 0) / 100
    const paid = txns.filter((t) => t.kind === 'payment').reduce((s, t) => s + toCents(t.amount), 0) / 100
    const per = new Map<string, { key: string; name: string; due: number; paid: number }>()
    for (const t of ledger.data?.txns ?? []) {
      const key = t.project_id ?? 'none'
      const p = per.get(key) ?? { key, name: t.project?.name ?? 'من غير مشروع', due: 0, paid: 0 }
      p[t.kind === 'due' ? 'due' : 'paid'] += toCents(t.amount)
      per.set(key, p)
    }
    const spent = (ledger.data?.spent ?? []).reduce((s, e) => s + toCents(e.amount), 0) / 100
    return {
      lines,
      due,
      paid,
      spent,
      perProject: [...per.values()].map((p) => ({ ...p, due: p.due / 100, paid: p.paid / 100 })),
    }
  }, [ledger.data, project])

  if ((names.loading && !names.data) || (ledger.loading && !ledger.data))
    return <p className="muted">جارٍ التحميل...</p>
  if (names.failed || ledger.failed) return <p className="msg msg-error">مقدرناش نحمّل المقاول، جرّب تاني</p>
  if (!name) {
    return (
      <div className="page-stack">
        <h1 className="page-title">المقاول مش موجود</h1>
        <a className="btn btn-ghost" href="#/contractors">
          رجوع للمقاولين
        </a>
      </div>
    )
  }

  const left = view.due - view.paid
  const pickable = (ledger.data?.txns ?? []).some((t) => !t.project_id) ? [{ id: 'none', name: 'من غير مشروع' }] : []
  const filterOptions = [
    ...view.perProject.filter((p) => p.key !== 'none').map((p) => ({ id: p.key, name: p.name })),
    ...pickable,
  ]

  return (
    <div className="page-stack">
      <PageHead
        title={name}
        parent={{ label: 'مستحقات المقاولين', href: '#/contractors' }}
        actions={
          canEdit && (
            <>
              <button className="btn btn-ghost btn-icon" onClick={() => setDialog({ kind: 'due' })}>
                <Plus size={18} aria-hidden="true" />
                مستحق جديد
              </button>
              <button className="btn btn-icon" onClick={() => setDialog({ kind: 'payment' })}>
                <Wallet size={18} aria-hidden="true" />
                تسجيل دفعة
              </button>
            </>
          )
        }
      />

      <Stats
        items={[
          { label: 'المستحقات', value: view.due },
          { label: 'المدفوع', value: view.paid, tone: 'ok' },
          { label: 'المتبقي علينا', value: left, tone: left > 0 ? 'err' : 'ok' },
        ]}
      />

      {view.perProject.length > 1 && (
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">حسب المشروع</h2>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th>مستحقات</th>
                  <th>مدفوع</th>
                  <th>المتبقي</th>
                </tr>
              </thead>
              <tbody>
                {view.perProject.map((p) => (
                  <tr key={p.key}>
                    <td className="strong">{p.name}</td>
                    <td className="num">{money(p.due)}</td>
                    <td className="num tone-text-ok">{money(p.paid)}</td>
                    <td className={`num strong ${p.due - p.paid > 0 ? 'tone-text-err' : ''}`}>
                      {money(p.due - p.paid)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">المستحقات والمدفوعات</h2>
          {filterOptions.length > 1 && (
            <select value={project} onChange={(e) => setProject(e.target.value)} aria-label="المشروع">
              <option value="">كل المشاريع</option>
              {filterOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
        {view.lines.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th className="sm-hide">المشروع</th>
                  <th className="sm-hide">ملاحظات</th>
                  <th>مستحق</th>
                  <th>مدفوع</th>
                  <th>الرصيد</th>
                  {canEdit && <th aria-label="تعديل" />}
                </tr>
              </thead>
              <tbody>
                {view.lines.map(({ t, run }) => (
                  <tr key={t.id}>
                    <td>{dateText(t.txn_date)}</td>
                    <td>{t.kind === 'due' ? 'مستحق' : 'دفعة'}</td>
                    <td className="sm-hide">{t.project?.name ?? '—'}</td>
                    <td className="sm-hide muted">{t.notes ?? ''}</td>
                    <td className="num">{t.kind === 'due' ? money(t.amount) : ''}</td>
                    <td className="num tone-text-ok">{t.kind === 'payment' ? money(t.amount) : ''}</td>
                    <td className={`num strong ${run > 0 ? 'tone-text-err' : ''}`}>{money(run)}</td>
                    {canEdit && (
                      <td>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => setDialog({ kind: t.kind, row: t })}
                          aria-label="تعديل"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty muted">مفيش مستحقات أو مدفوعات لسه.</p>
        )}
        <p className="muted small panel-note">
          المتبقي = المستحقات − المدفوع. مصروفات مسجلة باسمه في القيود: {money(view.spent)} ج.م (للعلم بس، مش داخلة في
          الرصيد).
        </p>
      </section>

      {dialog && (
        <TxnDialog
          contractorId={id}
          name={name}
          kind={dialog.kind}
          row={dialog.row}
          project={project && project !== 'none' ? project : undefined}
          projects={projects.data ?? []}
          onClose={() => setDialog(null)}
          onSaved={ledger.reload}
        />
      )}
    </div>
  )
}
