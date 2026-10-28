import { supabase } from './supabase'
import { fetchPaged } from './paged'
import { downloadWorkbook } from './excelCommon'
import { todayISO } from './format'

/** Every table of the database with the column its rows are ordered by while reading (stable paging). */
const TABLES: [string, string][] = [
  ['entries', 'seq'], ['projects', 'id'], ['expense_categories', 'id'], ['expense_items', 'id'], ['contractors', 'id'],
  ['contractor_transactions', 'id'], ['bank_accounts', 'id'], ['advances', 'id'], ['advance_installments', 'id'],
  ['advance_returns', 'id'], ['profiles', 'id'], ['user_permissions', 'user_id'], ['user_advance_access', 'user_id'],
  ['entry_counters', 'year'], ['entry_history', 'id'], ['backup_log', 'id'],
]

const BACKUP_EVERY_DAYS = 7

export type LastBackup = { at: string | null; stale: boolean }

export async function lastBackup(): Promise<LastBackup | null> {
  const { data, error } = await supabase.from('backup_log').select('at').order('at', { ascending: false }).limit(1)
  if (error) return null
  const at = data?.[0]?.at ?? null
  const days = at ? (Date.now() - new Date(at).getTime()) / 86_400_000 : Infinity
  return { at, stale: days >= BACKUP_EVERY_DAYS }
}

const cell = (v: unknown) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : (v as string | number | boolean | null))

/** Reads every table (the deleted entries too), saves them as one Excel file with a sheet per table, and logs the backup. */
export async function downloadBackup(userId: string): Promise<boolean> {
  const sheets: { name: string; rows: Record<string, unknown>[] }[] = []
  for (const [name, order] of TABLES) {
    const rows = await fetchPaged<Record<string, unknown>>((from, to) =>
      // table names are dynamic here, so the typed client is bypassed on purpose
      (supabase as unknown as { from: (t: string) => { select: (c: string) => { order: (c: string) => { range: (a: number, b: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }> } } } })
        .from(name).select('*').order(order).range(from, to),
    )
    if (!rows) return false
    sheets.push({ name, rows })
  }
  const trash = await supabase.rpc('deleted_entries')
  if (trash.error) return false
  sheets.push({ name: 'entries_deleted', rows: (trash.data ?? []) as Record<string, unknown>[] })

  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name)
    const cols = [...new Set(s.rows.flatMap((r) => Object.keys(r)))]
    ws.addRow(cols).font = { bold: true }
    for (const r of s.rows) ws.addRow(cols.map((c) => cell(r[c])))
  }
  await downloadWorkbook(wb, `المصباح-نسخة-احتياطية-${todayISO()}.xlsx`)
  const { error } = await supabase.from('backup_log').insert({ by: userId, note: `${sheets.reduce((n, s) => n + s.rows.length, 0)} صف` })
  return !error
}
