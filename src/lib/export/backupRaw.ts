import type { Col, Row, Sheet } from './backupTypes'
import type { BackupData } from './backupSheets'

const RAW_TAB = 'FF8A4B2D'
const CELL_MAX = 32000 // Excel refuses more than 32 767 characters in one cell

const cell = (v: unknown): string => {
  if (v == null) return ''
  const t = typeof v === 'object' ? JSON.stringify(v) : String(v)
  return t.length > CELL_MAX ? t.slice(0, CELL_MAX) : t
}

/** Every column exactly as stored (codes and links kept), so the data can be loaded back into the database. */
function rawSheet(name: string, rows: Row[]): Sheet {
  const keys: string[] = []
  for (const r of rows) for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
  const cols: Col[] = keys.map((k) => ({ h: k, kind: 'text', w: 18, get: (r) => cell(r[k]) }))
  return { name, cols, rows, tab: RAW_TAB }
}

const README: [string, string][] = [
  [
    'الغرض',
    'الأوراق اللي اسمها raw_* هي نسخة خام من الجداول، بنفس أسماء الأعمدة في قاعدة البيانات، عشان تتستخدم لو احتجنا نرجّع البيانات من الإكسيل.',
  ],
  [
    'الربط بين الجداول',
    'الأعمدة اللي اسمها id هي الأكواد، والأعمدة project_id وcontractor_id وbank_id وadvance_id وcreated_by وغيرها بتشاور على id في الجدول التاني.',
  ],
  ['القيمة الفاضية', 'الخلية الفاضية معناها NULL، والتواريخ مكتوبة نص بصيغة ISO، والـ JSON مكتوب نص.'],
  [
    'الجداول',
    'raw_entries، raw_projects، raw_expense_categories، raw_expense_items، raw_contractors، raw_contractor_transactions، raw_bank_accounts، raw_bank_transfers، raw_advances، raw_advance_installments، raw_advance_returns، raw_profiles، raw_user_permissions، raw_user_advance_access، raw_user_bank_access، raw_entry_history، raw_backup_log، raw_entry_counters، raw_deleted_entries.',
  ],
  [
    'مش موجود هنا',
    'كلمات المرور وحسابات الدخول، ومفاتيح الإشعارات، وملفات الفواتير، وهيكل قاعدة البيانات والصلاحيات (الرجوع الكامل بيكون من ملف .dump).',
  ],
]

/** Sheets for the automatic backup only: a short guide plus the raw tables. */
export function rawSheets(d: BackupData): Sheet[] {
  const guide: Sheet = {
    name: 'اقرأني (للاسترجاع)',
    rows: README.map(([topic, text]) => ({ topic, text })),
    cols: [
      { h: 'الموضوع', w: 22, get: (r) => r.topic },
      { h: 'الشرح', w: 110, get: (r) => r.text },
    ],
    tab: RAW_TAB,
  }
  const raw: [string, Row[]][] = [
    ['raw_entries', d.entries],
    ['raw_projects', d.projects],
    ['raw_expense_categories', d.categories],
    ['raw_expense_items', d.items],
    ['raw_contractors', d.contractors],
    ['raw_contractor_transactions', d.ctx],
    ['raw_bank_accounts', d.banks],
    ['raw_bank_transfers', d.transfers],
    ['raw_advances', d.advances],
    ['raw_advance_installments', d.inst],
    ['raw_advance_returns', d.rets],
    ['raw_profiles', d.profiles],
    ['raw_user_permissions', d.perms],
    ['raw_user_advance_access', d.access],
    ['raw_user_bank_access', d.bankAccess],
    ['raw_entry_history', d.history],
    ['raw_backup_log', d.log],
    ['raw_entry_counters', d.counters],
    ['raw_deleted_entries', d.trash],
  ]
  return [guide, ...raw.map(([name, rows]) => rawSheet(name, rows))]
}
