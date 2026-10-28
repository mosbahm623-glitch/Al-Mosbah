import { useMemo, useState } from 'react'
import PageHead from '../../components/PageHead'
import { TYPE_LABEL, todayISO, type ProjectType } from '../../lib/format'
import { useAsync } from '../../lib/useAsync'
import { supabase } from '../../lib/supabase'
import { fetchSummaries, type ProjectSummary } from '../../lib/projects'
import { fetchAdvanceSummaries, type AdvanceSummary } from '../../lib/advances'
import { fetchBankSummaries, type BankSummary } from '../../lib/banks'
import type { BudgetMode } from '../../lib/reportBuilders'
import ProjectReport from '../projects/ProjectReport'
import AdvanceReport from '../advances/AdvanceReport'
import Journal from './Journal'
import PeriodReport from './PeriodReport'
import CategoryReport from './CategoryReport'
import BudgetReport from './BudgetReport'
import ApprovalsReport from './ApprovalsReport'
import ContractorsSummary from './ContractorsSummary'
import ContractorStatement from './ContractorStatement'
import BankStatement from './BankStatement'
import PendingReport, { type PendingStatus } from './PendingReport'

type ReportType = 'journal' | 'period' | 'project' | 'category' | 'budget' | 'advance' | 'contractor' | 'contractors' | 'bank' | 'pending' | 'approvals'

const GROUPS: { label: string; items: { value: ReportType; label: string }[] }[] = [
  {
    label: 'اليومية والفترات',
    items: [
      { value: 'journal', label: 'اليومية' },
      { value: 'period', label: 'تقرير فترة' },
    ],
  },
  {
    label: 'المشاريع',
    items: [
      { value: 'project', label: 'تقرير مشروع' },
      { value: 'category', label: 'المصروفات حسب البند' },
      { value: 'budget', label: 'متابعة الميزانيات' },
    ],
  },
  {
    label: 'الحسابات',
    items: [
      { value: 'advance', label: 'كشف عهدة' },
      { value: 'contractor', label: 'كشف حساب مقاول' },
      { value: 'contractors', label: 'ملخص كل المقاولين' },
      { value: 'bank', label: 'كشف حساب بنك' },
    ],
  },
  {
    label: 'المتابعة',
    items: [
      { value: 'approvals', label: 'الموافقات (قرارات يوم)' },
      { value: 'pending', label: 'حالة القيود (معلّقة / مقبولة / مرفوضة)' },
    ],
  },
]

type Named = { id: string; name: string }
const fetchPeople = () => supabase.from('profiles').select('id,full_name').order('full_name').returns<{ id: string; full_name: string | null }[]>()
const fetchContractors = () => supabase.from('contractors').select('id,name').order('name').returns<Named[]>()

const hasPeriod = (t: ReportType) => t === 'period' || t === 'category' || t === 'contractor' || t === 'contractors' || t === 'bank'
const hasColumns = (t: ReportType) => t === 'journal' || t === 'project' || t === 'advance' || t === 'period'

export default function Reports() {
  const projects = useAsync<ProjectSummary[]>(fetchSummaries)
  const advances = useAsync<AdvanceSummary[]>(fetchAdvanceSummaries)
  const banks = useAsync<BankSummary[]>(fetchBankSummaries)
  const contractors = useAsync<Named[]>(fetchContractors)
  const people = useAsync<{ id: string; full_name: string | null }[]>(fetchPeople)

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
  const [withContractor, setWithContractor] = useState(true)
  const [withBank, setWithBank] = useState(true)
  const [withNotes, setWithNotes] = useState(true)
  // nothing is drawn until "عرض التقرير" is pressed; changing any choice hides it again
  const [shown, setShown] = useState<{ key: string; n: number } | null>(null)

  const firstProject = projects.data?.[0]?.id ?? ''
  const pickedProject = type === 'period' ? projectId : projectId || firstProject
  const pickedAdvance = advanceId || advances.data?.[0]?.id || ''
  const pickedContractor = contractorId || contractors.data?.[0]?.id || ''
  const pickedBank = bankId || banks.data?.[0]?.id || ''
  const bank = banks.data?.find((b) => b.id === pickedBank)

  const rangeOk = !hasPeriod(type) || !from || !to || from <= to
  const target = {
    journal: day,
    period: 'all',
    project: pickedProject,
    category: 'all',
    budget: 'all',
    advance: pickedAdvance,
    contractor: pickedContractor,
    contractors: 'all',
    bank: pickedBank,
    pending: 'all',
    approvals: day,
  }[type]
  const key = useMemo(
    () =>
      JSON.stringify([
        type,
        target,
        hasPeriod(type) ? [from, to] : '',
        type === 'period' ? projectId : '',
        type === 'category' ? kindFilter : '',
        type === 'budget' ? budgetMode : '',
        type === 'pending' ? [pendingStatus, creatorId] : '',
        hasColumns(type) ? [withContractor, type === 'advance' ? '' : withBank, withNotes] : '',
      ]),
    [type, target, from, to, projectId, kindFilter, budgetMode, pendingStatus, creatorId, withContractor, withBank, withNotes],
  )
  const visible = shown?.key === key && Boolean(target) && rangeOk
  const cols = { withContractor, withBank, withNotes }
  const n = shown?.n ?? 0

  const select = (label: string, value: string, set: (v: string) => void, options: Named[] | undefined, loading: boolean, emptyText: string, all?: string) => (
    <label className="field">
      {label}
      <select value={value} onChange={(e) => set(e.target.value)} disabled={!options?.length}>
        {all && <option value="">{all}</option>}
        {!options?.length && !all && <option value="">{loading ? 'جارٍ التحميل...' : emptyText}</option>}
        {options?.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="page-stack">
      <div className="no-print">
        <PageHead title="التقارير والتصدير" />
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
              <input type="date" value={day} max={todayISO()} onChange={(e) => e.target.value && setDay(e.target.value)} />
            </label>
          )}

          {type === 'project' && select('المشروع', pickedProject, setProjectId, projects.data?.map((p) => ({ id: p.id, name: p.name })), projects.loading, 'مفيش مشاريع')}
          {type === 'period' && select('المشروع', projectId, setProjectId, projects.data?.map((p) => ({ id: p.id, name: p.name })), projects.loading, 'مفيش مشاريع', 'كل المشاريع')}
          {type === 'advance' && select('العهدة', pickedAdvance, setAdvanceId, advances.data?.map((a) => ({ id: a.id, name: a.holder_name + (a.status === 'closed' ? ' (مقفولة)' : '') })), advances.loading, 'مفيش عهد')}
          {type === 'contractor' && select('المقاول', pickedContractor, setContractorId, contractors.data ?? undefined, contractors.loading, 'مفيش مقاولين')}
          {type === 'bank' && select('البنك', pickedBank, setBankId, banks.data?.map((b) => ({ id: b.id, name: b.name })), banks.loading, 'مفيش بنوك')}

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
          {type === 'pending' && (
            <label className="field">
              سجّله
              <select value={creatorId} onChange={(e) => setCreatorId(e.target.value)}>
                <option value="">كل الأسماء</option>
                {(people.data ?? []).map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || 'بدون اسم'}</option>
                ))}
              </select>
            </label>
          )}

          {hasPeriod(type) && (
            <div className="field-row">
              <label className="field">
                من تاريخ
                <input type="date" value={from} max={to || todayISO()} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                إلى تاريخ
                <input type="date" value={to} min={from || undefined} max={todayISO()} onChange={(e) => setTo(e.target.value)} />
              </label>
            </div>
          )}
          {hasPeriod(type) && <p className="muted small">سيب التواريخ فاضية لو عايز كل الفترات.</p>}
          {!rangeOk && <p className="msg msg-error">تاريخ البداية بعد تاريخ النهاية.</p>}

          {hasColumns(type) && (
            <fieldset className="cols">
              <legend>أعمدة التقرير</legend>
              <label className="check">
                <input type="checkbox" checked={withContractor} onChange={(e) => setWithContractor(e.target.checked)} />
                المقاول
              </label>
              {type !== 'advance' && (
                <label className="check">
                  <input type="checkbox" checked={withBank} onChange={(e) => setWithBank(e.target.checked)} />
                  البنك
                </label>
              )}
              <label className="check">
                <input type="checkbox" checked={withNotes} onChange={(e) => setWithNotes(e.target.checked)} />
                الملاحظات
              </label>
            </fieldset>
          )}

          <button className="btn btn-primary" disabled={!target || !rangeOk} onClick={() => setShown({ key, n: n + 1 })}>
            عرض التقرير
          </button>
        </section>

        <div className="reports-preview">
          {!visible && (
            <div className="card empty no-print">
              <p>اختار نوع التقرير من الجنب واضغط «عرض التقرير».</p>
            </div>
          )}
          {visible && type === 'journal' && <Journal key={n} day={day} {...cols} />}
          {visible && type === 'approvals' && <ApprovalsReport key={n} day={day} />}
          {visible && type === 'period' && (
            <PeriodReport key={n} from={from} to={to} projectId={projectId} projectName={projects.data?.find((p) => p.id === projectId)?.name ?? ''} {...cols} />
          )}
          {visible && type === 'project' && <ProjectReport key={n} id={pickedProject} embedded={cols} />}
          {visible && type === 'category' && <CategoryReport key={n} from={from} to={to} type={kindFilter} />}
          {visible && type === 'budget' && <BudgetReport key={n} mode={budgetMode} />}
          {visible && type === 'advance' && <AdvanceReport key={n} id={pickedAdvance} embedded={cols} />}
          {visible && type === 'contractor' && (
            <ContractorStatement key={n} id={pickedContractor} name={contractors.data?.find((c) => c.id === pickedContractor)?.name ?? ''} from={from} to={to} />
          )}
          {visible && type === 'contractors' && <ContractorsSummary key={n} from={from} to={to} />}
          {visible && type === 'bank' && bank && <BankStatement key={n} id={bank.id} name={bank.name} opening={bank.opening_balance} from={from} to={to} />}
          {visible && type === 'pending' && <PendingReport key={n} status={pendingStatus} creatorId={creatorId} creatorName={people.data?.find((u) => u.id === creatorId)?.full_name ?? ''} />}
        </div>
      </div>
    </div>
  )
}
