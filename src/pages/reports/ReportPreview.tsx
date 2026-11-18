import ProjectReport from '../projects/ProjectReport'
import AdvanceReport from '../advances/AdvanceReport'
import ApprovalsReport from '../approvals/ApprovalsReport'
import type { ProjectType } from '../../lib/core/format'
import type { BankSummary } from '../../lib/banks/banks'
import type { BudgetMode } from '../../lib/reports/reportBuilders'
import type { ReportFilter } from '../../lib/reports/reportFilter'
import Journal from './Journal'
import PeriodReport from './PeriodReport'
import CategoryReport from './CategoryReport'
import BudgetReport from './BudgetReport'
import ContractorsSummary from './ContractorsSummary'
import ContractorStatement from './ContractorStatement'
import BankStatement from './BankStatement'
import PendingReport, { type PendingStatus } from './PendingReport'
import type { ReportType } from './reportTypes'

type Props = {
  type: ReportType
  /** nothing is drawn until the report was asked for and its choices are complete */
  visible: boolean
  /** counts the "show" presses: a new number remounts the report so it loads again */
  n: number
  day: string
  from: string
  to: string
  filter: ReportFilter
  cols: { withContractor: boolean; withBank: boolean; withNotes: boolean; withEnteredBy: boolean }
  projectId: string
  projectName: string
  pickedProject: string
  kindFilter: 'all' | ProjectType
  budgetMode: BudgetMode
  pickedAdvance: string
  parts: { given: boolean; spent: boolean; returned: boolean }
  pickedContractor: string
  contractorName: string
  includeClosed: boolean
  bank: BankSummary | undefined
  pendingStatus: PendingStatus
  creatorId: string
  creatorName: string
}

/** The right-hand side of the reports page: the chosen report, or a hint until one is asked for. */
export default function ReportPreview({
  type,
  visible,
  n,
  day,
  from,
  to,
  filter,
  cols,
  projectId,
  projectName,
  pickedProject,
  kindFilter,
  budgetMode,
  pickedAdvance,
  parts,
  pickedContractor,
  contractorName,
  includeClosed,
  bank,
  pendingStatus,
  creatorId,
  creatorName,
}: Props) {
  return (
    <div className="reports-preview">
      {!visible && (
        <div className="card empty no-print">
          <p>اختار نوع التقرير من الجنب واضغط «عرض التقرير».</p>
        </div>
      )}
      {visible && type === 'journal' && <Journal key={n} day={day} filter={filter} {...cols} />}
      {visible && type === 'approvals' && <ApprovalsReport key={n} day={day} filter={filter} />}
      {visible && type === 'period' && (
        <PeriodReport
          key={n}
          from={from}
          to={to}
          projectId={projectId}
          projectName={projectName}
          filter={filter}
          {...cols}
        />
      )}
      {visible && type === 'project' && <ProjectReport key={n} id={pickedProject} embedded={cols} filter={filter} />}
      {visible && type === 'category' && (
        <CategoryReport key={n} from={from} to={to} type={kindFilter} filter={filter} />
      )}
      {visible && type === 'budget' && <BudgetReport key={n} mode={budgetMode} filter={filter} />}
      {visible && type === 'advance' && (
        <AdvanceReport key={n} id={pickedAdvance} embedded={{ ...cols, parts }} filter={filter} />
      )}
      {visible && type === 'contractor' && (
        <ContractorStatement
          key={n}
          id={pickedContractor}
          name={contractorName}
          from={from}
          to={to}
          filter={filter}
          includeClosed={includeClosed}
        />
      )}
      {visible && type === 'contractors' && <ContractorsSummary key={n} from={from} to={to} filter={filter} />}
      {visible && type === 'bank' && bank && (
        <BankStatement
          key={n}
          id={bank.id}
          name={bank.name}
          opening={bank.opening_balance}
          from={from}
          to={to}
          filter={filter}
        />
      )}
      {visible && type === 'pending' && (
        <PendingReport key={n} status={pendingStatus} creatorId={creatorId} creatorName={creatorName} filter={filter} />
      )}
    </div>
  )
}
