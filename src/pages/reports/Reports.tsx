import { useCallback, useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import MergeCategoriesButton from './MergeCategoriesButton'
import { TYPE_LABEL, todayISO, type ProjectType } from '../../lib/core/format'
import { useAsync } from '../../lib/core/useAsync'
import { fetchSummaries, type ProjectSummary } from '../../lib/projects/projects'
import { fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances/advances'
import { fetchBankSummaries, type BankSummary } from '../../lib/banks/banks'
import type { BudgetMode } from '../../lib/reports/reportBuilders'
import { type PendingStatus } from './PendingReport'
import ReportPreview from './ReportPreview'
import { FILTERS, GROUPS, hasColumns, hasPeriod, type ReportType } from './reportTypes'
import ReportOptions from './ReportOptions'
import { pickerSelect } from './pickerSelect'
import ReportFilters from '../../components/ReportFilters'
import { fetchCategories, type Category } from '../../lib/entries/catalog'
import { NO_FILTER, only, type ReportFilter } from '../../lib/reports/reportFilter'
import { fetchContractorNames, fetchPeople, fetchProjectContractors, type Named } from '../../lib/core/lookups'

export default function Reports() {
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const banks = useAsync<BankSummary[]>(fetchBankSummaries)
  const contractors = useAsync<Named[]>(fetchContractorNames)
  const people = useAsync<{ id: string; full_name: string | null }[]>(fetchPeople)
  const categories = useAsync<Category[]>(fetchCategories)
  const projectContractors = useAsync<Map<string, Set<string>>>(
    useCallback(async () => {
      const m = await fetchProjectContractors()
      return { data: m, error: m === null }
    }, []),
  )

  const [type, setType] = useState<ReportType>('journal')
  const [day, setDay] = useState(todayISO)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [projectId, setProjectId] = useState('')
  const [advanceId, setAdvanceId] = useState('')
  const [contractorId, setContractorId] = useState('')
  const [bankId, setBankId] = useState('')
  const [kindFilter, setKindFilter] = useState<'all' | ProjectType>('all')
  const [budgetMode, setBudgetMode] = useState<BudgetMode>('all')
  const [pendingStatus, setPendingStatus] = useState<PendingStatus>('pending')
  const [creatorId, setCreatorId] = useState('')
  const [filterAll, setFilterAll] = useState<ReportFilter>(NO_FILTER)
  const [includeClosed, setIncludeClosed] = useState(false)
  const [withContractor, setWithContractor] = useState(true)
  const [withBank, setWithBank] = useState(true)
  const [withNotes, setWithNotes] = useState(true)
  const [withEnteredBy, setWithEnteredBy] = useState(true)
  // custody statement: which parts to show (the received payments, the spending, the returns)
  const [parts, setParts] = useState({ given: true, spent: true, returned: true })
  // nothing is drawn until "عرض التقرير" is pressed; changing any choice hides it again
  const [shown, setShown] = useState<{ key: string; n: number } | null>(null)

  // nothing is picked for the person: a report of a project / custody / contractor / bank is asked for by choosing it
  // with a project chosen, only the contractors who worked on it are offered
  const projectsOnly = filterAll.project ? projectContractors.data?.get(filterAll.project) : undefined
  const contractorList = useMemo(
    () =>
      filterAll.project
        ? (contractors.data ?? []).filter((c) => projectContractors.data?.get(filterAll.project)?.has(c.name))
        : (contractors.data ?? []),
    [contractors.data, projectContractors.data, filterAll.project],
  )
  // a contractor who did not work on the chosen project is not swapped for another one behind the person's back
  const pickedContractor = contractorList.find((c) => c.id === contractorId)?.id ?? ''
  const contractorNotOnProject = Boolean(contractorId && !pickedContractor && filterAll.project)
  const pickedBank = bankId
  const bank = banks.data?.find((b) => b.id === pickedBank)

  // only the filters this report offers take part
  const filter = useMemo(() => {
    const f = only(filterAll, FILTERS[type])
    return projectsOnly && f.contractor && !projectsOnly.has(f.contractor) ? { ...f, contractor: '' } : f
  }, [filterAll, type, projectsOnly])
  // with a contractor chosen, only the projects he worked on are offered (the mirror of the contractor list above)
  const contractorForProjects =
    type === 'contractor' ? (contractorList.find((c) => c.id === pickedContractor)?.name ?? '') : filterAll.contractor
  const projectOptions = useMemo(() => {
    const names = (projects.data ?? []).map((p) => p.name)
    const byProject = projectContractors.data
    return contractorForProjects && byProject
      ? names.filter((n) => byProject.get(n)?.has(contractorForProjects))
      : names
  }, [projects.data, projectContractors.data, contractorForProjects])
  const filterOptions = {
    project: projectOptions,
    contractor: contractorList.map((c) => c.name),
    bank: (banks.data ?? []).map((b) => b.name),
    category: (categories.data ?? []).map((c) => c.name),
  }

  const rangeOk = !hasPeriod(type) || !from || !to || from <= to
  const partsOk = type !== 'advance' || parts.given || parts.spent || parts.returned
  const targets: Record<ReportType, string> = {
    journal: day,
    period: 'all',
    project: projectId,
    category: 'all',
    budget: 'all',
    advance: advanceId,
    contractor: pickedContractor,
    contractors: 'all',
    bank: pickedBank,
    pending: 'all',
    approvals: day,
  }
  const target = targets[type]
  // a plain string (cheap to build) that changes whenever any choice that shapes the report changes
  const key = JSON.stringify([
    type,
    target,
    hasPeriod(type) ? [from, to] : '',
    type === 'period' ? projectId : '',
    type === 'category' ? kindFilter : '',
    type === 'budget' ? budgetMode : '',
    type === 'pending' ? [pendingStatus, creatorId] : '',
    type === 'contractor' ? includeClosed : '',
    hasColumns(type) ? [withContractor, type === 'advance' ? '' : withBank, withNotes, withEnteredBy] : '',
    type === 'advance' ? parts : '',
    filter,
  ])
  const visible = shown?.key === key && Boolean(target) && rangeOk && partsOk
  const cols = { withContractor, withBank, withNotes, withEnteredBy }
  const n = shown?.n ?? 0

  const projectChoices = projects.data?.map((p) => ({ id: p.id, name: p.name }))
  const bankChoices = banks.data?.map((b) => ({ id: b.id, name: b.name }))

  const filtersBox = (
    <ReportFilters keys={FILTERS[type]} value={filterAll} options={filterOptions} onChange={setFilterAll} />
  )

  return (
    <div className="page-stack">
      <div className="no-print">
        <PageHead
          title="التقارير والتصدير"
          actions={<MergeCategoriesButton categories={categories.data ?? []} onSaved={categories.reload} />}
        />
      </div>
      {(projects.failed || advances.failed || banks.failed || contractors.failed) && (
        <p className="msg msg-error no-print">مقدرناش نحمّل بعض الاختيارات، جرّب تاني</p>
      )}

      <div className="reports-layout">
        <section className="panel ctl no-print" aria-label="خيارات التقرير">
          <label className="field">
            نوع التقرير
            <select value={type} onChange={(e) => setType(e.target.value as ReportType)}>
              {GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>

          {(type === 'journal' || type === 'approvals') && (
            <label className="field">
              التاريخ
              <input
                type="date"
                value={day}
                max={todayISO()}
                onChange={(e) => e.target.value && setDay(e.target.value)}
              />
            </label>
          )}

          {type === 'contractor' && filtersBox}
          {type === 'project' &&
            pickerSelect('المشروع', projectId, setProjectId, projectChoices, projects.loading, 'مفيش مشاريع')}
          {type === 'period' &&
            pickerSelect(
              'المشروع',
              projectId,
              setProjectId,
              projectChoices,
              projects.loading,
              'مفيش مشاريع',
              'كل المشاريع',
            )}
          {type === 'advance' &&
            pickerSelect(
              'العهدة',
              advanceId,
              setAdvanceId,
              advances.data?.map((a) => ({
                id: a.id,
                name: a.holder_name + (a.status === 'closed' ? ' (مقفولة)' : ''),
              })),
              advances.loading,
              'مفيش عهد',
            )}
          {type === 'contractor' &&
            pickerSelect(
              'المقاول',
              pickedContractor,
              setContractorId,
              contractorList,
              contractors.loading || projectContractors.loading,
              filterAll.project ? 'مفيش مقاولين على المشروع ده' : 'مفيش مقاولين',
            )}
          {type === 'bank' && pickerSelect('البنك', pickedBank, setBankId, bankChoices, banks.loading, 'مفيش بنوك')}

          {type === 'category' && (
            <label className="field">
              نوع المشاريع
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as 'all' | ProjectType)}>
                <option value="all">كل الأنواع</option>
                <option value="finishing">{TYPE_LABEL.finishing}</option>
                <option value="furnishing">{TYPE_LABEL.furnishing}</option>
              </select>
            </label>
          )}
          {type === 'budget' && (
            <label className="field">
              المشاريع
              <select value={budgetMode} onChange={(e) => setBudgetMode(e.target.value as BudgetMode)}>
                <option value="all">كل المشاريع اللي ليها ميزانية</option>
                <option value="near">اللي قربت من الميزانية (80% أو أكتر)</option>
                <option value="over">اللي تجاوزت الميزانية</option>
              </select>
            </label>
          )}
          {type === 'pending' && (
            <label className="field">
              الحالة
              <select value={pendingStatus} onChange={(e) => setPendingStatus(e.target.value as PendingStatus)}>
                <option value="pending">معلّقة</option>
                <option value="approved">مقبولة</option>
                <option value="rejected">مرفوضة</option>
                <option value="all">الكل</option>
              </select>
            </label>
          )}
          {type === 'pending' &&
            pickerSelect(
              'سجّله',
              creatorId,
              setCreatorId,
              (people.data ?? []).map((u) => ({ id: u.id, name: u.full_name || 'بدون اسم' })),
              people.loading,
              'مفيش أسماء',
              'كل الأسماء',
            )}

          {type !== 'contractor' && filtersBox}

          {hasPeriod(type) && (
            <div className="field-row">
              <label className="field">
                من تاريخ
                <input type="date" value={from} max={to || todayISO()} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                إلى تاريخ
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={todayISO()}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
            </div>
          )}
          {hasPeriod(type) && <p className="muted small">سيب التواريخ فاضية لو عايز كل الفترات.</p>}
          {!rangeOk && <p className="msg msg-error">تاريخ البداية بعد تاريخ النهاية.</p>}
          {contractorNotOnProject && (
            <p className="msg msg-error">
              المقاول ده ماشتغلش على المشروع المختار. اختار مقاول تاني أو شيل فلتر المشروع.
            </p>
          )}

          {type === 'contractor' && (
            <label className="check">
              <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
              تضمين المشاريع المقفولة
            </label>
          )}

          <ReportOptions
            type={type}
            parts={parts}
            setParts={setParts}
            partsOk={partsOk}
            withContractor={withContractor}
            setWithContractor={setWithContractor}
            withBank={withBank}
            setWithBank={setWithBank}
            withEnteredBy={withEnteredBy}
            setWithEnteredBy={setWithEnteredBy}
            withNotes={withNotes}
            setWithNotes={setWithNotes}
          />

          <button
            className="btn btn-primary"
            disabled={!target || !rangeOk || !partsOk}
            onClick={() => setShown({ key, n: n + 1 })}
          >
            عرض التقرير
          </button>
        </section>

        <ReportPreview
          type={type}
          visible={visible}
          n={n}
          day={day}
          from={from}
          to={to}
          filter={filter}
          cols={cols}
          projectId={projectId}
          projectName={projects.data?.find((p) => p.id === projectId)?.name ?? ''}
          pickedProject={projectId}
          kindFilter={kindFilter}
          budgetMode={budgetMode}
          pickedAdvance={advanceId}
          parts={parts}
          pickedContractor={pickedContractor}
          contractorName={contractorList.find((c) => c.id === pickedContractor)?.name ?? ''}
          includeClosed={includeClosed}
          bank={bank}
          pendingStatus={pendingStatus}
          creatorId={creatorId}
          creatorName={people.data?.find((u) => u.id === creatorId)?.full_name ?? ''}
        />
      </div>
    </div>
  )
}
