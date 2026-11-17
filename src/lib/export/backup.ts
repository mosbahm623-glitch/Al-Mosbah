import { supabase } from '../supabase'
import { fetchPaged } from '../paged'
import { writeBackupWorkbook } from './backupWorkbook'
import { str, type Col, type Kind, type Row, type Sheet } from './backupTypes'

const BACKUP_EVERY_DAYS = 7
const SHEET_NAME_MAX = 31
const PROJECT_TAB = 'FF1F5FA8'

/**
 * An Excel-safe sheet name that is not taken yet: no \ / ? * [ ] :, no quote at either end, at most 31 characters.
 * A clash (the letter case does not matter) gets " (2)", " (3)" … Records the name in `taken`.
 */
export function sheetName(raw: string, taken: Set<string>): string {
  const base =
    raw
      .replace(/[\\/?*[\]:]/g, '-')
      .replace(/^'+|'+$/g, '')
      .trim()
      .slice(0, SHEET_NAME_MAX)
      .trim() || 'مشروع'
  let name = base
  for (let n = 2; taken.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = base.slice(0, SHEET_NAME_MAX - suffix.length).trim() + suffix
  }
  taken.add(name.toLowerCase())
  return name
}

export type LastBackup = { at: string | null; stale: boolean }

export async function lastBackup(): Promise<LastBackup | null> {
  const { data, error } = await supabase.from('backup_log').select('at').order('at', { ascending: false }).limit(1)
  if (error) return null
  const at = data?.[0]?.at ?? null
  const days = at ? (Date.now() - new Date(at).getTime()) / 86_400_000 : Infinity
  return { at, stale: days >= BACKUP_EVERY_DAYS }
}

type Reader = (
  t: string,
  order: string,
  from: number,
  to: number,
) => PromiseLike<{ data: Row[] | null; error: unknown }>
// table names are dynamic here, so the typed client is bypassed on purpose
const read: Reader = (t, order, from, to) =>
  (
    supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => ReturnType<Reader> } }
      }
    }
  )
    .from(t)
    .select('*')
    .order(order)
    .range(from, to)

const KIND: Record<string, string> = { income: 'وارد', expense: 'مصروف', due: 'مستحق', payment: 'دفعة' }
const STATUS: Record<string, string> = {
  pending: 'مستنّي موافقة',
  approved: 'معتمد',
  rejected: 'مرفوض',
  deleted: 'محذوف',
  open: 'مفتوحة',
  closed: 'مقفولة',
  active: 'نشط',
  done: 'منتهي',
}
const ACTION: Record<string, string> = {
  edit: 'تعديل',
  approve: 'موافقة',
  reject: 'رفض',
  delete: 'مسح',
  restore: 'استرجاع',
  hard_delete: 'مسح نهائي',
}
const ROLE: Record<string, string> = { admin: 'أدمن', user: 'مستخدم' }
const LEVEL: Record<string, string> = { view: 'عرض', edit: 'تعديل' }
const tr = (m: Record<string, string>, v: unknown) => (v == null ? '' : (m[String(v)] ?? String(v)))

/** Reads every table (the deleted entries too) and saves one tidy Excel file: Arabic sheets, names instead of codes. Logs the backup. */
export async function downloadBackup(userId: string): Promise<boolean> {
  const need = async (t: string, order = 'id') => fetchPaged<Row>((a, b) => read(t, order, a, b))
  const [
    entries,
    projects,
    categories,
    items,
    contractors,
    ctx,
    banks,
    transfers,
    advances,
    inst,
    rets,
    profiles,
    perms,
    access,
    bankAccess,
    history,
    log,
    counters,
  ] = await Promise.all([
    need('entries', 'seq'),
    need('projects'),
    need('expense_categories'),
    need('expense_items'),
    need('contractors'),
    need('contractor_transactions'),
    need('bank_accounts'),
    need('bank_transfers'),
    need('advances'),
    need('advance_installments'),
    need('advance_returns'),
    need('profiles'),
    need('user_permissions', 'user_id'),
    need('user_advance_access', 'user_id'),
    need('user_bank_access', 'user_id'),
    need('entry_history'),
    need('backup_log'),
    need('entry_counters', 'year'),
  ])
  const trash = await supabase.rpc('deleted_entries')
  if (
    trash.error ||
    [
      entries,
      projects,
      categories,
      items,
      contractors,
      ctx,
      banks,
      transfers,
      advances,
      inst,
      rets,
      profiles,
      perms,
      access,
      bankAccess,
      history,
      log,
      counters,
    ].some((x) => !x)
  )
    return false
  const T = (x: Row[] | null) => x as Row[]

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
      tab: PROJECT_TAB,
    })

  await writeBackupWorkbook(sheets)
  const { error } = await supabase.from('backup_log').insert({ by: userId, note: `${rowsTotal} صف` })
  return !error
}
