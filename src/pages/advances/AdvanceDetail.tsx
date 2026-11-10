import { useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
import Segmented from '../../components/Segmented'
import { FileText, Pencil } from 'lucide-react'
import { useAuth } from '../../auth/AuthProvider'
import { advanceBalance, setAdvanceStatus, type AdvanceReturn, type Installment } from '../../lib/advances'
import type { Entry } from '../../lib/projects'
import { useAdvanceData } from '../../lib/useAdvanceData'
import { useAsync } from '../../lib/useAsync'
import { fetchSummaries } from '../../lib/projects'
import EntryDialog from '../../components/EntryDialog'
import AdvanceEntriesPanel from './AdvanceEntriesPanel'
import InstallmentsPanel from './InstallmentsPanel'
import ReturnsPanel from './ReturnsPanel'
import AdvanceChip from './AdvanceChip'
import AdvanceDialog from './AdvanceDialog'
import MoneyDialog from './MoneyDialog'

type Money = { kind: 'installment' | 'return'; row?: Installment | AdvanceReturn }

/** One list at a time: the approved expenses, those still waiting for approval, what was handed over, what came back. */
const TABS = ['approved', 'pending', 'removed', 'installments', 'returns'] as const

export default function AdvanceDetail({ id }: { id: string }) {
  const { can, isStaff, isAdmin, canTouch } = useAuth()
  const canEdit = can('advances', 'edit')
  const { advance, installments, returns, entries, loading, failed, reload } = useAdvanceData(id)
  const projects = useAsync(fetchSummaries)
  const [money_, setMoney] = useState<Money | null>(null)
  const [spending, setSpending] = useState(false)
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<(typeof TABS)[number]>('approved')

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
  // a rejected expense goes back to its holder, so it waits with the pending ones until he fixes or deletes it
  const approved = (entries ?? []).filter((e) => e.status === 'approved')
  const waiting = (entries ?? []).filter((e) => e.status === 'pending' || e.status === 'rejected')
  const removed = (entries ?? []).filter((e) => e.status === 'deleted')
  const current = tab === 'removed' && removed.length === 0 ? 'approved' : tab

  async function toggleStatus() {
    if (!advance) return
    const { error } = await setAdvanceStatus(id, advance.status === 'open' ? 'closed' : 'open')
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
            {isStaff && (
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

      <div className="toolbar">
        <Segmented
          label="أقسام العهدة"
          value={current}
          options={[
            { value: 'approved', label: `مصروفات معتمدة · ${approved.length}` },
            { value: 'pending', label: `تحت الموافقة · ${waiting.length}` },
            ...(removed.length > 0 ? [{ value: 'removed' as const, label: `محذوفة · ${removed.length}` }] : []),
            { value: 'installments', label: `الدفعات · ${installments?.length ?? 0}` },
            { value: 'returns', label: `المرتجعات · ${returns?.length ?? 0}` },
          ]}
          onChange={setTab}
        />
      </div>

      {current === 'approved' && (
        <AdvanceEntriesPanel
          key="approved"
          entries={approved}
          title="المصروفات المعتمدة"
          empty="مفيش مصروفات معتمدة من العهدة لسه."
          canEdit={canEdit}
          canTouch={canTouch}
          onSpend={() => setSpending(true)}
          onEdit={setEditingEntry}
        />
      )}

      {current === 'pending' && (
        <AdvanceEntriesPanel
          key="pending"
          entries={waiting}
          title="مصروفات تحت الموافقة"
          empty="مفيش مصروفات مستنية الموافقة."
          canEdit={canEdit}
          canTouch={canTouch}
          onSpend={() => setSpending(true)}
          onEdit={setEditingEntry}
        />
      )}

      {current === 'removed' && (
        <AdvanceEntriesPanel
          key="removed"
          entries={removed}
          title="مصروفات محذوفة"
          empty="مفيش مصروفات محذوفة."
          canEdit={false}
          canTouch={canTouch}
          onSpend={() => setSpending(true)}
          onEdit={setEditingEntry}
        />
      )}

      {current === 'installments' && (
        <InstallmentsPanel
          installments={installments}
          isStaff={isStaff}
          isAdmin={isAdmin}
          onAdd={() => setMoney({ kind: 'installment' })}
          onEdit={(row) => setMoney({ kind: 'installment', row })}
        />
      )}

      {current === 'returns' && (
        <ReturnsPanel
          returns={returns}
          isStaff={isStaff}
          onAdd={() => setMoney({ kind: 'return' })}
          onEdit={(row) => setMoney({ kind: 'return', row })}
        />
      )}

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
