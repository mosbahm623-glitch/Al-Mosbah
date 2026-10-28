import { supabase } from './supabase'
import type { Database } from './database.types'
import { fetchPaged } from './paged'
import { HEAD_FILL, INK, MONEY, SOFT_FILL, border, downloadWorkbook, header, solid, toDate } from './excelCommon'
import { todayISO } from './format'
import { ENTRY_STATUS_LABEL, HISTORY_ACTION_LABEL } from './labels'

type Row = Record<string, unknown>
type Kind = 'text' | 'money' | 'date' | 'time' | 'int' | 'tech'
type Col = { h: string; kind?: Kind; w?: number; get: (r: Row) => unknown }

const BACKUP_EVERY_DAYS = 7

type LastBackup = { at: string | null; stale: boolean }

export async function lastBackup(): Promise<LastBackup | null> {
  const { data, error } = await supabase.from('backup_log').select('at').order('at', { ascending: false }).limit(1)
  if (error) return null
  const at = data?.[0]?.at ?? null
  const days = at ? (Date.now() - new Date(at).getTime()) / 86_400_000 : Infinity
  return { at, stale: days >= BACKUP_EVERY_DAYS }
}

type TableName = keyof Database['public']['Tables']
type Reader = (t: TableName, order: string, from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>
// the table name is dynamic here, so the column list is not known to the typed client
const read: Reader = (t, order, from, to) => supabase.from(t).select('*').order(order).range(from, to)

const KIND: Record<string, string> = { income: 'وارد', expense: 'مصروف', due: 'مستحق', payment: 'دفعة' }
const STATUS: Record<string, string> = { ...ENTRY_STATUS_LABEL, open: 'مفتوحة', closed: 'مقفولة', active: 'نشط', done: 'منتهي' }
const ACTION = HISTORY_ACTION_LABEL
const ROLE: Record<string, string> = { admin: 'أدمن', owner: 'مالك', user: 'مستخدم' }
const LEVEL: Record<string, string> = { view: 'عرض', edit: 'تعديل' }
const tr = (m: Record<string, string>, v: unknown) => (v == null ? '' : (m[String(v)] ?? String(v)))
const str = (v: unknown) => (v == null ? '' : String(v))
const day = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : '')

/** Reads every table (the deleted entries too) and saves one tidy Excel file: Arabic sheets, names instead of codes. Logs the backup. */
export async function downloadBackup(userId: string): Promise<boolean> {
  const need = async (t: TableName, order = 'id') => fetchPaged<Row>((a, b) => read(t, order, a, b))
  const [entries, projects, categories, items, contractors, ctx, banks, advances, inst, rets, profiles, perms, access, history, log, counters] = await Promise.all([
    need('entries', 'seq'), need('projects'), need('expense_categories'), need('expense_items'), need('contractors'),
    need('contractor_transactions'), need('bank_accounts'), need('advances'), need('advance_installments'),
    need('advance_returns'), need('profiles'), need('user_permissions', 'user_id'), need('user_advance_access', 'user_id'),
    need('entry_history'), need('backup_log'), need('entry_counters', 'year'),
  ])
  const trash = await supabase.rpc('deleted_entries')
  if (trash.error || [entries, projects, categories, items, contractors, ctx, banks, advances, inst, rets, profiles, perms, access, history, log, counters].some((x) => !x)) return false
  const T = (x: Row[] | null) => x as Row[]

  const names = (rows: Row[], key: string) => new Map(rows.map((r) => [str(r.id), str(r[key])]))
  const project = names(T(projects), 'name')
  const contractor = names(T(contractors), 'name')
  const bank = names(T(banks), 'name')
  const holder = names(T(advances), 'holder_name')
  const person = names(T(profiles), 'full_name')
  const category = names(T(categories), 'name')
  const look = (m: Map<string, string>) => (v: unknown) => (v == null ? '' : (m.get(String(v)) ?? ''))
  const P = look(project), C = look(contractor), B = look(bank), H = look(holder), U = look(person), CAT = look(category)
  const col = (h: string, key: string, kind?: Kind, w?: number): Col => ({ h, kind, w, get: (r) => r[key] })
  const id = (key = 'id'): Col => ({ h: 'المعرّف (للأرشيف)', kind: 'tech', w: 14, get: (r) => r[key] })

  const sheets: { name: string; cols: Col[]; rows: Row[] }[] = [
    {
      name: 'القيود',
      rows: T(entries),
      cols: [
        col('رقم القيد', 'seq', 'int', 12), col('التاريخ', 'entry_date', 'date'), { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) },
        { h: 'المشروع', w: 22, get: (r) => P(r.project_id) }, col('البند', 'category', 'text', 18), col('البيان', 'item', 'text', 26),
        { h: 'المقاول', w: 18, get: (r) => C(r.contractor_id) }, { h: 'البنك', w: 18, get: (r) => B(r.bank_id) },
        { h: 'من عهدة', w: 16, get: (r) => H(r.advance_id) }, col('المبلغ', 'amount', 'money'),
        { h: 'الحالة', w: 14, get: (r) => tr(STATUS, r.status) }, col('ملاحظات', 'notes', 'text', 28),
        { h: 'سجّله', w: 16, get: (r) => U(r.created_by) }, col('وقت التسجيل', 'created_at', 'time'),
        { h: 'قرّر', w: 16, get: (r) => U(r.decided_by) }, col('وقت القرار', 'decided_at', 'time'), col('رقم التعديل', 'rev', 'int', 11), id(),
      ],
    },
    {
      name: 'القيود المحذوفة',
      rows: (trash.data ?? []) as Row[],
      cols: [
        col('رقم القيد', 'seq', 'int', 12), col('التاريخ', 'entry_date', 'date'), { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) },
        col('المشروع', 'project', 'text', 22), col('البند', 'category', 'text', 18), col('البيان', 'item', 'text', 26),
        col('المقاول', 'contractor', 'text', 18), col('المبلغ', 'amount', 'money'), { h: 'كان', w: 14, get: (r) => tr(STATUS, r.status_before_delete) },
        col('ملاحظات', 'notes', 'text', 28), col('سجّله', 'created_by_name', 'text', 16), col('اتمسح بواسطة', 'deleted_by_name', 'text', 16), col('سبب المسح', 'delete_reason', 'text', 30),
        col('وقت المسح', 'deleted_at', 'time'), id(),
      ],
    },
    {
      name: 'المشاريع',
      rows: T(projects),
      cols: [col('المشروع', 'name', 'text', 28), col('النوع', 'type', 'text', 16), { h: 'الحالة', w: 12, get: (r) => tr(STATUS, r.status) }, col('الميزانية', 'budget', 'money'), col('اتسجّل في', 'created_at', 'time'), id()],
    },
    { name: 'البنود', rows: T(categories), cols: [col('البند', 'name', 'text', 28), id()] },
    { name: 'بيانات البنود', rows: T(items), cols: [{ h: 'البند', w: 24, get: (r) => CAT(r.category_id) }, col('البيان', 'name', 'text', 30), id()] },
    { name: 'المقاولين', rows: T(contractors), cols: [col('المقاول', 'name', 'text', 30), col('اتسجّل في', 'created_at', 'time'), id()] },
    {
      name: 'حركات المقاولين',
      rows: T(ctx),
      cols: [col('التاريخ', 'txn_date', 'date'), { h: 'المقاول', w: 24, get: (r) => C(r.contractor_id) }, { h: 'المشروع', w: 22, get: (r) => P(r.project_id) }, { h: 'النوع', w: 10, get: (r) => tr(KIND, r.kind) }, col('المبلغ', 'amount', 'money'), col('ملاحظات', 'notes', 'text', 28), id()],
    },
    { name: 'البنوك', rows: T(banks), cols: [col('الحساب', 'name', 'text', 28), col('الرصيد الافتتاحي', 'opening_balance', 'money'), col('اتسجّل في', 'created_at', 'time'), id()] },
    { name: 'العهد', rows: T(advances), cols: [col('صاحب العهدة', 'holder_name', 'text', 26), { h: 'الحالة', w: 12, get: (r) => tr(STATUS, r.status) }, col('ملاحظات', 'notes', 'text', 28), col('اتسجّلت في', 'created_at', 'time'), id()] },
    { name: 'دفعات العهد', rows: T(inst), cols: [col('التاريخ', 'paid_on', 'date'), { h: 'صاحب العهدة', w: 24, get: (r) => H(r.advance_id) }, col('المبلغ', 'amount', 'money'), id()] },
    { name: 'مرتجعات العهد', rows: T(rets), cols: [col('التاريخ', 'returned_on', 'date'), { h: 'صاحب العهدة', w: 24, get: (r) => H(r.advance_id) }, col('المبلغ', 'amount', 'money'), col('ملاحظات', 'notes', 'text', 28), id()] },
    {
      name: 'المستخدمين',
      rows: T(profiles),
      cols: [col('الاسم', 'full_name', 'text', 24), col('الإيميل', 'email', 'text', 28), { h: 'الدور', w: 12, get: (r) => tr(ROLE, r.role) }, { h: 'مفعّل', w: 10, get: (r) => (r.is_active ? 'نعم' : 'لا') }, col('اتسجّل في', 'created_at', 'time'), id()],
    },
    { name: 'الصلاحيات', rows: T(perms), cols: [{ h: 'المستخدم', w: 24, get: (r) => U(r.user_id) }, col('القسم', 'module', 'text', 16), { h: 'المستوى', w: 12, get: (r) => tr(LEVEL, r.level) }] },
    { name: 'وصول العهد', rows: T(access), cols: [{ h: 'المستخدم', w: 24, get: (r) => U(r.user_id) }, { h: 'العهدة', w: 24, get: (r) => H(r.advance_id) }] },
    {
      name: 'سجل التعديلات',
      rows: T(history),
      cols: [col('رقم القيد', 'seq', 'int', 12), { h: 'الإجراء', w: 12, get: (r) => tr(ACTION, r.action) }, { h: 'بواسطة', w: 18, get: (r) => U(r.changed_by) }, col('الوقت', 'changed_at', 'time'), { h: 'قبل', w: 40, get: (r) => str(r.old_row ? JSON.stringify(r.old_row) : '') }, { h: 'بعد', w: 40, get: (r) => str(r.new_row ? JSON.stringify(r.new_row) : '') }],
    },
    { name: 'سجل النسخ', rows: T(log), cols: [col('الوقت', 'at', 'time'), { h: 'بواسطة', w: 18, get: (r) => U(r.by) }, col('ملاحظة', 'note', 'text', 24)] },
    { name: 'عدّاد القيود', rows: T(counters), cols: [col('السنة', 'year', 'int', 10), col('آخر رقم', 'last', 'int', 12)] },
  ]

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()

  const cover = wb.addWorksheet('ملخص', { views: [{ rightToLeft: true, showGridLines: false }] })
  cover.columns = [{ width: 30 }, { width: 16 }]
  const title = cover.addRow(['المصباح — نسخة احتياطية'])
  cover.mergeCells(1, 1, 1, 2)
  title.height = 36
  title.getCell(1).font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  title.getCell(1).fill = solid(HEAD_FILL)
  title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  const meta = cover.addRow(['تاريخ النسخة', new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' })])
  meta.getCell(1).font = { bold: true }
  cover.addRow([])
  header(cover.addRow(['الورقة', 'عدد الصفوف']))
  for (const s of sheets) {
    const r = cover.addRow([s.name, s.rows.length])
    r.eachCell((c) => { c.border = border })
    r.getCell(1).value = { text: s.name, hyperlink: `#'${s.name}'!A1` }
    r.getCell(1).font = { color: { argb: 'FF1F5FA8' }, underline: true }
  }

  const fmt = { money: MONEY, int: '0', date: 'yyyy-mm-dd', time: 'yyyy-mm-dd hh:mm' } as const
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }], properties: { tabColor: { argb: s.name === 'القيود المحذوفة' ? 'FFC74634' : 'FF312D2A' } } })
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    ws.columns = s.cols.map((c) => ({ width: c.w ?? (c.kind === 'money' ? 16 : c.kind === 'date' ? 13 : c.kind === 'time' ? 19 : 14) }))
    header(ws.addRow(s.cols.map((c) => c.h)))
    s.rows.forEach((r, i) => {
      const row = ws.addRow(s.cols.map((c) => {
        const v = c.get(r)
        if (v == null || v === '') return null
        if (c.kind === 'money' || c.kind === 'int') return Number(v)
        if (c.kind === 'date') return toDate(day(v))
        if (c.kind === 'time') return new Date(String(v))
        return String(v)
      }))
      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const c = s.cols[n - 1]
        cell.border = border
        cell.alignment = { vertical: 'middle', horizontal: c.kind === 'money' || c.kind === 'int' || c.kind === 'date' || c.kind === 'time' ? 'center' : 'right', wrapText: false }
        if (c.kind && c.kind !== 'text' && c.kind !== 'tech') cell.numFmt = fmt[c.kind]
        if (c.kind === 'tech') cell.font = { size: 8, color: { argb: 'FF9A948E' } }
        else if (c.kind === 'money') cell.font = { bold: true, color: { argb: INK } }
        if (i % 2 === 1) cell.fill = solid(SOFT_FILL)
      })
    })
    if (s.rows.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.cols.length } }
    // totals of money columns (SUBTOTAL follows the filter)
    const m = s.cols.findIndex((c) => c.kind === 'money')
    if (m >= 0 && s.rows.length > 0) {
      const letter = ws.getColumn(m + 1).letter
      const tot = ws.addRow([])
      tot.getCell(Math.max(1, m)).value = 'الإجمالي (حسب الفلتر)'
      tot.getCell(m + 1).value = { formula: `SUBTOTAL(109,${letter}2:${letter}${s.rows.length + 1})` }
      tot.getCell(m + 1).numFmt = MONEY
      tot.eachCell((c) => { c.font = { bold: true }; c.fill = solid(SOFT_FILL); c.border = border; c.alignment = { horizontal: 'center' } })
    }
  }

  await downloadWorkbook(wb, `المصباح-نسخة-احتياطية-${todayISO()}.xlsx`)
  const { error } = await supabase.from('backup_log').insert({ by: userId, note: `${sheets.reduce((n, s) => n + s.rows.length, 0)} صف` })
  return !error
}
