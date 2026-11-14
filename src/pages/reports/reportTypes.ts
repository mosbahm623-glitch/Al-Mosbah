import type { FilterKey } from '../../lib/reportFilter'

export type ReportType =
  | 'journal'
  | 'period'
  | 'project'
  | 'category'
  | 'budget'
  | 'advance'
  | 'contractor'
  | 'contractors'
  | 'bank'
  | 'pending'
  | 'approvals'

/** The kinds of report and how the picker groups them. */
export const GROUPS: { label: string; items: { value: ReportType; label: string }[] }[] = [
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

/** Which optional filters each report offers (the thing a report is already about is not repeated). */
export const FILTERS: Record<ReportType, readonly FilterKey[]> = {
  journal: ['project', 'contractor', 'bank', 'category'],
  period: ['contractor', 'bank', 'category'],
  project: ['contractor', 'bank', 'category'],
  category: ['project', 'contractor', 'bank', 'category'],
  budget: ['project'],
  advance: ['project', 'contractor', 'bank', 'category'],
  contractor: ['project', 'category'],
  contractors: ['project', 'contractor'],
  bank: ['project', 'contractor', 'category'],
  pending: ['project', 'contractor', 'bank', 'category'],
  approvals: ['project', 'contractor', 'bank', 'category'],
}

/** Which reports take a from / to period, and which let the person hide columns. */
export const hasPeriod = (t: ReportType) =>
  t === 'period' || t === 'category' || t === 'contractor' || t === 'contractors' || t === 'bank'
export const hasColumns = (t: ReportType) => t === 'journal' || t === 'project' || t === 'advance' || t === 'period'
