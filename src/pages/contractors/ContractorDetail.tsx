import { Fragment, useCallback, useMemo, useState } from 'react'
import { Pencil, Plus, Wallet } from 'lucide-react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { useAuth } from '../../auth/AuthProvider'
import { fetchContractorLedger, type LedgerTxn, type Spent } from '../../lib/contractors/contractors'
import { dateText, money } from '../../lib/core/format'
import { fetchContractorNames, fetchProjectNames, type Named } from '../../lib/core/lookups'
import { toCents } from '../../lib/core/money'
import { useAsync } from '../../lib/core/useAsync'
import ContractorWork from './ContractorWork'
import TxnDialog from './TxnDialog'

type Dialog = { kind: 'due' | 'payment'; row?: LedgerTxn; project?: string } | null

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
  const [dialog, setDialog] = useState<Dialog>(null)
  const name = names.data?.find((c) => c.id === id)?.name

  const view = useMemo(() => {
    const groups = new Map<string, { key: string; name: string; txns: LedgerTxn[] }>()
    for (const t of ledger.data?.txns ?? []) {
      const key = t.project_id ?? 'none'
      const g = groups.get(key) ?? { key, name: t.project?.name ?? 'من غير مشروع', txns: [] }
      g.txns.push(t)
      groups.set(key, g)
    }
    const projects = [...groups.values()]
      .map((g) => {
        const due = g.txns.filter((t) => t.kind === 'due').reduce((s, t) => s + toCents(t.amount), 0) / 100
        const paid = g.txns.filter((t) => t.kind === 'payment').reduce((s, t) => s + toCents(t.amount), 0) / 100
        const lines = g.txns.map((t, i) => ({
          t,
          run:
            g.txns.slice(0, i + 1).reduce((sum, x) => sum + toCents(x.kind === 'due' ? x.amount : -x.amount), 0) / 100,
        }))
        return { ...g, due, paid, lines }
      })
      .sort((x, y) => (x.key === 'none' ? 1 : y.key === 'none' ? -1 : x.name.localeCompare(y.name, 'ar')))
    const spent = (ledger.data?.spent ?? []).reduce((s, e) => s + toCents(e.amount), 0) / 100
    return { projects, spent }
  }, [ledger.data])

  if ((names.loading && !names.data) || (ledger.loading && !ledger.data)) return <p className="muted">جارٍ التحميل...</p>
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

      {view.projects.length ? (
        view.projects.map((p) => {
          const left = p.due - p.paid
          return (
            <section className="panel" key={p.key}>
              <div className="panel-head">
                <h2 className="section-title">{p.name}</h2>
                {canEdit && p.key !== 'none' && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => setDialog({ kind: 'due', project: p.key })}
                    >
                      <Plus size={16} aria-hidden="true" />
                      مستحق
                    </button>
                    <button
                      className="btn btn-ghost btn-icon"
                      onClick={() => setDialog({ kind: 'payment', project: p.key })}
                    >
                      <Wallet size={16} aria-hidden="true" />
                      دفعة
                    </button>
                  </div>
                )}
              </div>
              <Stats
                items={[
                  { label: 'المستحقات', value: p.due },
                  { label: 'المدفوع', value: p.paid, tone: 'ok' },
                  { label: 'المتبقي علينا', value: left, tone: left > 0 ? 'err' : 'ok' },
                ]}
              />
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>النوع</th>
                      <th className="sm-hide">ملاحظات</th>
                      <th>مستحق</th>
                      <th>مدفوع</th>
                      <th>الرصيد</th>
                      {canEdit && <th aria-label="تعديل" />}
                    </tr>
                  </thead>
                  <tbody>
                    {p.lines.map(({ t, run }) => (
                      <Fragment key={t.id}>
                        <tr>
                          <td>{dateText(t.txn_date)}</td>
                          <td>{t.kind === 'due' ? 'مستحق' : 'دفعة'}</td>
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
                        {t.items
                          .slice()
                          .sort((a, b) => a.position - b.position)
                          .map((it) => (
                            <tr key={it.id} className="muted small">
                              <td />
                              <td>↳ {it.item}</td>
                              <td className="sm-hide">{it.category ?? ''}</td>
                              <td className="num">{money(it.amount)}</td>
                              <td colSpan={canEdit ? 3 : 2} />
                            </tr>
                          ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })
      ) : (
        <section className="panel">
          <p className="empty muted">مفيش مستحقات أو مدفوعات لسه.</p>
        </section>
      )}
      <ContractorWork id={id} name={name} canEdit={canEdit} />
      <p className="muted small panel-note">
        حساب المقاول لكل مشروع لوحده: المتبقي = المستحقات − المدفوع في المشروع نفسه. مصروفات مسجلة باسمه في القيود:{' '}
        {money(view.spent)} ج.م (للعلم بس، مش داخلة في الرصيد).
      </p>

      {dialog && (
        <TxnDialog
          contractorId={id}
          name={name}
          kind={dialog.kind}
          row={dialog.row}
          project={dialog.project}
          projects={projects.data ?? []}
          onClose={() => setDialog(null)}
          onSaved={ledger.reload}
        />
      )}
    </div>
  )
}
