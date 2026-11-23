import { str, type Col, type Kind, type Row, type Sheet } from './backupTypes'
import { ACTION, KIND, LEVEL, ROLE, STATUS, tr } from './backupLabels'
import { sheetName } from './sheetName'

const PROJECT_TAB = 'FF1F5FA8'
const CLOSED_TAB = 'FF7D7770'

/** Every table the backup reads (plus the deleted entries), as plain rows. */
export type BackupData = {
  entries: Row[]
  projects: Row[]
  categories: Row[]
  items: Row[]
  contractors: Row[]
  ctx: Row[]
  dueItems: Row[]
  banks: Row[]
  transfers: Row[]
  advances: Row[]
  inst: Row[]
  rets: Row[]
  profiles: Row[]
  perms: Row[]
  access: Row[]
  bankAccess: Row[]
  history: Row[]
  log: Row[]
  counters: Row[]
  trash: Row[]
}

/** Pure layout of the backup: Arabic sheets, names instead of codes. No browser, no network. */
export function buildBackupSheets(d: BackupData): { sheets: Sheet[]; rowsTotal: number } {
  const { entries, projects, categories, items, contractors, ctx, banks, transfers, advances, inst, rets } = d
  const { profiles, perms, access, bankAccess, history, log, counters } = d
  const trash = { data: d.trash }
  const T = (x: Row[]) => x

  const names = (rows: Row[], key: string) => new Map(rows.map((r) => [str(r.id), str(r[key])]))
  const project = names(T(projects), 'name')
  const contractor = names(T(contractors), 'name')
  const bank = names(T(banks), 'name')
  const holder = names(T(advances), 'holder_name')
  const person = names(T(profiles), 'full_name')
  const category = names(T(categories), 'name')
  const look = (m: Map<string, string>) => (v: unknown) => (v == null ? '' : (m.get(String(v)) ?? ''))
  const P = look(project),
    C = look(contractor),
    B = look(bank),
    H = look(holder),
    U = look(person),
    CAT = look(category)
  const col = (h: string, key: string, kind?: Kind, w?: number): Col => ({ h, kind, w, get: (r) => r[key] })
  const id = (key = 'id'): Col => ({ h: 'المعرّف (للأرشيف)', kind: 'tech', w: 14, get: (r) => r[key] })

  const projectCol: Col = { h: 'المشروع', w: 22, get: (r) => P(r.project_id) }
  const entryCols: Col[] = [
    col('رقم القيد', 'seq', 'int', 12),
    col('التاريخ', 'entry_date', 'date'),
    { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) },
    projectCol,
    col('البند', 'category', 'text', 18),
    col('البيان', 'item', 'text', 26),
    { h: 'المقاول', w: 18, get: (r) => C(r.contractor_id) },
    { h: 'البنك', w: 18, get: (r) => B(r.bank_id) },
    { h: 'من عهدة', w: 16, get: (r) => H(r.advance_id) },
    col('المبلغ', 'amount', 'money'),
    { h: 'الحالة', w: 14, get: (r) => tr(STATUS, r.status) },
    col('ملاحظات', 'notes', 'text', 28),
    { h: 'سجّله', w: 16, get: (r) => U(r.created_by) },
    col('وقت التسجيل', 'created_at', 'time'),
    { h: 'قرّر', w: 16, get: (r) => U(r.decided_by) },
    col('وقت القرار', 'decided_at', 'time'),
    col('رقم التعديل', 'rev', 'int', 11),
    id(),
  ]

  const sheets: Sheet[] = [
    { name: 'القيود', rows: T(entries), cols: entryCols },
    {
      name: 'القيود المحذوفة',
      rows: (trash.data ?? []) as Row[],
      cols: [
        col('رقم القيد', 'seq', 'int', 12),
        col('التاريخ', 'entry_date', 'date'),
        { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) },
        col('المشروع', 'project', 'text', 22),
        col('البند', 'category', 'text', 18),
        col('البيان', 'item', 'text', 26),
        col('المقاول', 'contractor', 'text', 18),
        col('المبلغ', 'amount', 'money'),
        { h: 'كان', w: 14, get: (r) => tr(STATUS, r.status_before_delete) },
        col('ملاحظات', 'notes', 'text', 28),
        col('سجّله', 'created_by_name', 'text', 16),
        col('اتمسح بواسطة', 'deleted_by_name', 'text', 16),
        col('سبب المسح', 'delete_reason', 'text', 30),
        col('وقت المسح', 'deleted_at', 'time'),
        id(),
      ],
    },
    {
      name: 'المشاريع',
      rows: T(projects),
      cols: [
        col('المشروع', 'name', 'text', 28),
        col('النوع', 'type', 'text', 16),
        { h: 'الحالة', w: 12, get: (r) => tr(STATUS, r.status) },
        col('الميزانية', 'budget', 'money'),
        col('اتسجّل في', 'created_at', 'time'),
        id(),
      ],
    },
    { name: 'البنود', rows: T(categories), cols: [col('البند', 'name', 'text', 28), id()] },
    {
      name: 'بيانات البنود',
      rows: T(items),
      cols: [{ h: 'البند', w: 24, get: (r) => CAT(r.category_id) }, col('البيان', 'name', 'text', 30), id()],
    },
    {
      name: 'المقاولين',
      rows: T(contractors),
      cols: [col('المقاول', 'name', 'text', 30), col('اتسجّل في', 'created_at', 'time'), id()],
    },
    {
      name: 'حركات المقاولين',
      rows: T(ctx),
      cols: [
        col('التاريخ', 'txn_date', 'date'),
        { h: 'المقاول', w: 24, get: (r) => C(r.contractor_id) },
        { h: 'المشروع', w: 22, get: (r) => P(r.project_id) },
        { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) },
        col('المبلغ', 'amount', 'money'),
        col('ملاحظات', 'notes', 'text', 28),
        id(),
      ],
    },
    {
      name: 'البنوك',
      rows: T(banks),
      cols: [
        col('الحساب', 'name', 'text', 28),
        col('الرصيد الافتتاحي', 'opening_balance', 'money'),
        col('اتسجّل في', 'created_at', 'time'),
        id(),
      ],
    },
    {
      name: 'تحويلات البنوك',
      rows: T(transfers).map((r) => ({
        ...r,
        from_name: B(r.from_bank),
        to_name: B(r.to_bank),
      })),
      cols: [
        col('التاريخ', 'transfer_date', 'date'),
        col('من بنك', 'from_name', 'text', 24),
        col('إلى بنك', 'to_name', 'text', 24),
        col('المبلغ', 'amount', 'money'),
        col('ملاحظات', 'notes', 'text', 28),
        id(),
      ],
    },
    {
      name: 'العهد',
      rows: T(advances),
      cols: [
        col('صاحب العهدة', 'holder_name', 'text', 26),
        { h: 'الحالة', w: 12, get: (r) => tr(STATUS, r.status) },
        col('ملاحظات', 'notes', 'text', 28),
        col('اتسجّلت في', 'created_at', 'time'),
        id(),
      ],
    },
    {
      name: 'دفعات العهد',
      rows: T(inst),
      cols: [
        col('التاريخ', 'paid_on', 'date'),
        { h: 'صاحب العهدة', w: 24, get: (r) => H(r.advance_id) },
        col('المبلغ', 'amount', 'money'),
        { h: 'الحالة', w: 12, get: (r) => tr(STATUS, r.status) },
        col('سبب الرفض', 'reject_reason'),
        id(),
      ],
    },
    {
      name: 'مرتجعات العهد',
      rows: T(rets),
      cols: [
        col('التاريخ', 'returned_on', 'date'),
        { h: 'صاحب العهدة', w: 24, get: (r) => H(r.advance_id) },
        col('المبلغ', 'amount', 'money'),
        col('ملاحظات', 'notes', 'text', 28),
        id(),
      ],
    },
    {
      name: 'المستخدمين',
      rows: T(profiles),
      cols: [
        col('الاسم', 'full_name', 'text', 24),
        col('الإيميل', 'email', 'text', 28),
        { h: 'الدور', w: 12, get: (r) => tr(ROLE, r.role) },
        { h: 'مفعّل', w: 10, get: (r) => (r.is_active ? 'نعم' : 'لا') },
        col('اتسجّل في', 'created_at', 'time'),
        id(),
      ],
    },
    {
      name: 'الصلاحيات',
      rows: T(perms),
      cols: [
        { h: 'المستخدم', w: 24, get: (r) => U(r.user_id) },
        col('القسم', 'module', 'text', 16),
        { h: 'المستوى', w: 12, get: (r) => tr(LEVEL, r.level) },
      ],
    },
    {
      name: 'وصول العهد',
      rows: T(access),
      cols: [
        { h: 'المستخدم', w: 24, get: (r) => U(r.user_id) },
        { h: 'العهدة', w: 24, get: (r) => H(r.advance_id) },
      ],
    },
    {
      name: 'بنوك المالك',
      rows: T(bankAccess),
      cols: [
        { h: 'المستخدم', w: 24, get: (r) => U(r.user_id) },
        { h: 'البنك', w: 24, get: (r) => B(r.bank_id) },
      ],
    },
    {
      name: 'سجل التعديلات',
      rows: T(history),
      cols: [
        col('رقم القيد', 'seq', 'int', 12),
        { h: 'الإجراء', w: 12, get: (r) => tr(ACTION, r.action) },
        { h: 'بواسطة', w: 18, get: (r) => U(r.changed_by) },
        col('الوقت', 'changed_at', 'time'),
        { h: 'قبل', w: 40, get: (r) => str(r.old_row ? JSON.stringify(r.old_row) : '') },
        { h: 'بعد', w: 40, get: (r) => str(r.new_row ? JSON.stringify(r.new_row) : '') },
      ],
    },
    {
      name: 'سجل النسخ',
      rows: T(log),
      cols: [
        col('الوقت', 'at', 'time'),
        { h: 'بواسطة', w: 18, get: (r) => U(r.by) },
        col('ملاحظة', 'note', 'text', 24),
      ],
    },
    {
      name: 'عدّاد القيود',
      rows: T(counters),
      cols: [col('السنة', 'year', 'int', 10), col('آخر رقم', 'last', 'int', 12)],
    },
  ]
  // the entries are not counted twice: the per-project tabs below only repeat them
  const rowsTotal = sheets.reduce((n, s) => n + s.rows.length, 0)

  // one tab per project (open ones first, then the closed), with that project's entries
  const byProject = new Map<string, Row[]>()
  for (const e of T(entries)) {
    const list = byProject.get(str(e.project_id))
    if (list) list.push(e)
    else byProject.set(str(e.project_id), [e])
  }
  const taken = new Set(['ملخص', ...sheets.map((s) => s.name)].map((n) => n.toLowerCase()))
  const inProject = entryCols.filter((c) => c !== projectCol)
  const closedLast = (p: Row) => Number(p.status === 'closed')
  for (const p of [...T(projects)].sort(
    (a, b) => closedLast(a) - closedLast(b) || str(a.name).localeCompare(str(b.name), 'ar'),
  ))
    sheets.push({
      name: sheetName(str(p.name), taken),
      rows: byProject.get(str(p.id)) ?? [],
      cols: inProject,
      tab: p.status === 'closed' ? CLOSED_TAB : PROJECT_TAB,
      banner: `${str(p.name)} — ${p.status === 'closed' ? 'مقفول' : 'شغال'}`,
      note: p.status === 'closed' ? 'مقفول' : 'شغال',
    })

  return { sheets, rowsTotal }
}
