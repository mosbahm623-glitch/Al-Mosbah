import { useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import { FileText, Pencil, Plus, Undo2 } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { advanceBalance, type AdvanceReturn, type Installment } from '../../lib/advances'
import { dateText, money } from '../../lib/format'
import type { Entry } from '../../lib/projects'
import { supabase } from '../../lib/supabase'
import { useAdvanceData } from '../../lib/useAdvanceData'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries } from '../../lib/projects'
import EntryDialog from '../../components/EntryDialog'
import AdvanceChip from './AdvanceChip'
import AdvanceDialog from './AdvanceDialog'
import MoneyDialog from './MoneyDialog'

type Money = { kind: 'installment' | 'return'; row?: Installment | AdvanceReturn }

export default function AdvanceDetail({ id }: { id: string }) {
  const { can, isStaff: isAdmin } = useAuth()
  const canEdit = can('advances', 'edit')
  const { advance, installments, returns, entries, loading, failed, reload } = useAdvanceData(id)
  const projects = useAsync(fetchSummaries)
  const [money_, setMoney] = useState<Money | null>(null)
  const [spending, setSpending] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [editing, setEditing] = useState(false)

  if (loading) return <p className="muted">جارٍ التحميل...</p>
  if (failed) return <p className="msg msg-error">مقدرناش نحمّل العهدة، جرّب تاني</p>
  if (!advance) {
    return (
      <div className="page-stack">
        <h1 className="page-title">العهدة مش موجودة</h1>
        <a className="btn btn-ghost" href="#/advances">
          رجوع للعهد
        </a>
      </div>
    )
  }

  const balance = advanceBalance(advance)

  async function toggleStatus() {
    if (!advance) return
    const { error } = await supabase
      .from('advances')
      .update({ status: advance.status === 'open' ? 'closed' : 'open' })
      .eq('id', id)
    if (!error) reload()
  }

  return (
    <div className="page-stack">
      <PageHead
        title={advance.holder_name}
        parent={{ label: 'العهد', href: '#/advances' }}
        chips={<AdvanceChip status={advance.status} />}
        note={advance.notes}
        actions={
          <>
            <a className="btn btn-ghost btn-icon" href={`#/advances/${id}/report`}>
              <FileText size={18} aria-hidden="true" />
              كشف / طباعة
            </a>
            {isAdmin && (
              <>
                <button className="btn btn-ghost btn-icon" onClick={() => setEditing(true)}>
                  <Pencil size={18} aria-hidden="true" />
                  تعديل
                </button>
                <button className="btn btn-ghost" onClick={() => void toggleStatus()}>
                  {advance.status === 'open' ? 'قفل العهدة' : 'إعادة فتح'}
                </button>
              </>
            )}
          </>
        }
      />

      <Stats
        items={[
          { label: 'المستلم', value: advance.given },
          { label: 'المصروف', value: advance.spent, tone: 'err' },
          { label: 'المرتجع', value: advance.returned },
          { label: 'الرصيد', value: balance, tone: balance >= 0 ? 'ok' : 'err' },
        ]}
      />

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">الدفعات</h2>
          {isAdmin && (
            <button className="btn btn-icon" onClick={() => setMoney({ kind: 'installment' })}>
              <Plus size={18} aria-hidden="true" />
              دفعة جديدة
            </button>
          )}
        </div>
        {installments?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  {isAdmin && (
                    <th>
                      <span className="sr-only">إجراءات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr key={i.id}>
                    <td className="num muted">{dateText(i.paid_on)}</td>
                    <td className="num strong">{money(i.amount)}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className="icon-btn"
                          aria-label="تعديل الدفعة"
                          onClick={() => setMoney({ kind: 'installment', row: i })}
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
          <p className="empty muted">مفيش دفعات لسه.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">المصروفات من العهدة</h2>
          {canEdit && (
            <button className="btn btn-icon" onClick={() => setSpending(true)}>
              <Plus size={18} aria-hidden="true" />
              مصروف من العهدة
            </button>
          )}
        </div>
        {entries?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>رقم القيد</th>
                  <th>التاريخ</th>
                  <th>المشروع</th>
                  <th>البند</th>
                  <th>البيان</th>
                  <th>المقاول</th>
                  <th>ملاحظات</th>
                  <th>سجّله</th>
                  <th>المبلغ</th>
                  {canEdit && (
                    <th>
                      <span className="sr-only">إجراءات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id}>
                    <td className="strong num">#{e.seq}</td>
                    <td className="num muted">{dateText(e.entry_date)}</td>
                    <td>{e.project?.name}</td>
                    <td>{e.category}</td>
                    <td className="strong">
                      {e.item}
                      {e.status === 'pending' && (
                        <>
                          {' '}
                          <span className="chip chip-warn">قيد الموافقة</span>
                        </>
                      )}
                      {e.status === 'rejected' && (
                        <>
                          {' '}
                          <span className="chip chip-err">مرفوض</span>
                        </>
                      )}
                    </td>
                    <td className="muted">{e.contractor?.name}</td>
                    <td className="muted">{e.notes}</td>
                    <td className="muted">{e.creator?.full_name}</td>
                    <td className="num strong tone-text-err">−{money(e.amount)}</td>
                    {canEdit && (
                      <td>
                        {(isAdmin || e.status !== 'approved') && (
                          <button
                            className="icon-btn"
                            aria-label={`تعديل القيد ${e.seq}`}
                            onClick={() => setEditingEntry(e)}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty muted">مفيش مصروفات من العهدة لسه.</p>
        )}
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="section-title">رد العهدة</h2>
          {isAdmin && (
            <button className="btn btn-ghost btn-icon" onClick={() => setMoney({ kind: 'return' })}>
              <Undo2 size={18} aria-hidden="true" />
              رد عهدة
            </button>
          )}
        </div>
        {returns?.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>المبلغ</th>
                  <th>ملاحظات</th>
                  {isAdmin && (
                    <th>
                      <span className="sr-only">إجراءات</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {returns.map((r) => (
                  <tr key={r.id}>
                    <td className="num muted">{dateText(r.returned_on)}</td>
                    <td className="num strong">{money(r.amount)}</td>
                    <td className="muted">{r.notes}</td>
                    {isAdmin && (
                      <td>
                        <button
                          className="icon-btn"
                          aria-label="تعديل المرتجع"
                          onClick={() => setMoney({ kind: 'return', row: r })}
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
          <p className="empty muted">مفيش مرتجعات.</p>
        )}
      </section>

      {money_ && (
        <MoneyDialog
          advanceId={id}
          holder={advance.holder_name}
          kind={money_.kind}
          row={
            money_.row
              ? {
                  id: money_.row.id,
                  amount: money_.row.amount,
                  date: 'paid_on' in money_.row ? money_.row.paid_on : money_.row.returned_on,
                  notes: 'notes' in money_.row ? money_.row.notes : null,
                }
              : undefined
          }
          onClose={() => setMoney(null)}
          onSaved={reload}
        />
      )}
      {spending && projects.data && (
        <EntryDialog
          projectId=""
          projectName={advance.holder_name}
          projects={projects.data}
          advanceId={id}
          onClose={() => setSpending(false)}
          onSaved={reload}
        />
      )}
      {editingEntry && projects.data && (
        <EntryDialog
          projectId={editingEntry.project_id ?? ''}
          projectName={advance.holder_name}
          projects={projects.data}
          entry={editingEntry}
          onClose={() => setEditingEntry(null)}
          onSaved={reload}
        />
      )}
      {editing && <AdvanceDialog advance={advance} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  )
}
