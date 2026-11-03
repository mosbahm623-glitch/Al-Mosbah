import { useState } from 'react'
import PageHead from '../../components/PageHead'
import Stats from '../../components/Stats'
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

export default function AdvanceDetail({ id }: { id: string }) {
  const { can, isStaff, isAdmin, canTouch } = useAuth()
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

      <InstallmentsPanel
        installments={installments}
        isStaff={isStaff}
        isAdmin={isAdmin}
        onAdd={() => setMoney({ kind: 'installment' })}
        onEdit={(row) => setMoney({ kind: 'installment', row })}
      />

      <AdvanceEntriesPanel
        entries={entries}
        canEdit={canEdit}
        canTouch={canTouch}
        onSpend={() => setSpending(true)}
        onEdit={setEditingEntry}
      />

      <ReturnsPanel
        returns={returns}
        isStaff={isStaff}
        onAdd={() => setMoney({ kind: 'return' })}
        onEdit={(row) => setMoney({ kind: 'return', row })}
      />

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
