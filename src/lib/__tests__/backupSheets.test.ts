import type { Workbook } from 'exceljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { query } from './supabaseMock'

vi.mock('../supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('../export/excelCommon', async (original) => ({
  ...(await original<typeof import('../export/excelCommon')>()),
  downloadWorkbook: vi.fn(async () => {}),
}))

import { supabase } from '../supabase'
import { downloadWorkbook } from '../export/excelCommon'
import { downloadBackup } from '../export/backup'
import { sheetName } from '../export/sheetName'

describe('sheetName', () => {
  it('keeps a normal name', () => {
    expect(sheetName('فيلا شامل', new Set())).toBe('فيلا شامل')
  })
  it('replaces the characters Excel refuses and trims quotes', () => {
    expect(sheetName("'a/b:c*d?e[f]g\\h'", new Set())).toBe('a-b-c-d-e-f-g-h')
  })
  it('cuts to 31 characters', () => {
    expect(sheetName('x'.repeat(40), new Set())).toHaveLength(31)
  })
  it('falls back when nothing is left', () => {
    expect(sheetName('  ', new Set())).toBe('مشروع')
    expect(sheetName("''", new Set())).toBe('مشروع')
  })
  it('numbers a name that is taken, whatever the letter case', () => {
    const taken = new Set<string>(['القيود', 'abc'])
    expect(sheetName('القيود', taken)).toBe('القيود (2)')
    expect(sheetName('ABC', taken)).toBe('ABC (2)')
    expect(sheetName('abc', taken)).toBe('abc (3)')
  })
  it('keeps the numbered name within 31 characters', () => {
    const taken = new Set<string>()
    const long = 'y'.repeat(35)
    sheetName(long, taken)
    const second = sheetName(long, taken)
    expect(second).toHaveLength(31)
    expect(second.endsWith(' (2)')).toBe(true)
  })
})

describe('downloadBackup: a tab for every project', () => {
  const projects = [
    { id: 'p1', name: 'فيلا شامل', status: 'active', type: 'finishing', budget: 0, created_at: '2026-01-01T00:00:00Z' },
    { id: 'p2', name: 'القيود', status: 'active', type: 'furnishing', budget: 0, created_at: '2026-01-02T00:00:00Z' },
    { id: 'p3', name: 'مقفول', status: 'closed', type: 'finishing', budget: 0, created_at: '2026-01-03T00:00:00Z' },
    { id: 'p4', name: 'فاضي', status: 'active', type: 'finishing', budget: 0, created_at: '2026-01-04T00:00:00Z' },
  ]
  const entries = [
    { id: 'e1', seq: 20260001, project_id: 'p1', kind: 'income', amount: 1000, status: 'approved', category: 'a' },
    { id: 'e2', seq: 20260002, project_id: 'p1', kind: 'expense', amount: 400, status: 'approved', category: 'b' },
    { id: 'e3', seq: 20260003, project_id: 'p2', kind: 'expense', amount: 50, status: 'approved', category: 'c' },
    { id: 'e4', seq: 20260004, project_id: 'p3', kind: 'expense', amount: 7, status: 'pending', category: 'd' },
  ]
  const tables: Record<string, unknown[]> = { entries, projects }

  beforeEach(() => {
    vi.mocked(downloadWorkbook).mockClear()
    vi.mocked(supabase.from).mockImplementation(((t: string) =>
      t === 'backup_log'
        ? { select: () => query({ data: [], error: null }).query, insert: () => query({ error: null }).query }
        : query({ data: tables[t] ?? [], error: null }).query) as never)
    vi.mocked(supabase.rpc).mockReturnValue(query({ data: [], error: null }).query)
  })

  const sentBook = () => vi.mocked(downloadWorkbook).mock.calls[0][0] as Workbook
  const rowsOf = (name: string) => {
    const ws = sentBook().getWorksheet(name)!
    const out: unknown[][] = []
    // row 1 is the header; the totals row at the bottom has no entry number
    ws.eachRow((r, n) => n > 1 && typeof r.getCell(1).value === 'number' && out.push((r.values as unknown[]).slice(1)))
    return out
  }

  it('adds one tab per project (open ones first, by name), after the usual sheets', async () => {
    expect(await downloadBackup('u1')).toBe(true)
    const names = sentBook().worksheets.map((w) => w.name)
    expect(names.slice(-4)).toEqual(['القيود (2)', 'فاضي', 'فيلا شامل', 'مقفول'])
    expect(names.indexOf('القيود')).toBeLessThan(names.indexOf('فاضي'))
  })

  it('puts each project’s own entries in its tab, without the project column', async () => {
    await downloadBackup('u1')
    const ws = sentBook().getWorksheet('فيلا شامل')!
    // row 1 is the state banner, row 2 the header
    expect(String(ws.getRow(1).getCell(1).value)).toBe('فيلا شامل — شغال')
    const head = (ws.getRow(2).values as unknown[]).slice(1)
    expect(head).not.toContain('المشروع')
    expect(head).toContain('رقم القيد')
    expect(rowsOf('فيلا شامل').map((r) => r[0])).toEqual([20260001, 20260002])
    expect(rowsOf('القيود (2)').map((r) => r[0])).toEqual([20260003])
    expect(rowsOf('مقفول').map((r) => r[0])).toEqual([20260004])
  })

  it('says on the tab and on the cover whether the project is running or closed', async () => {
    await downloadBackup('u1')
    expect(String(sentBook().getWorksheet('مقفول')!.getRow(1).getCell(1).value)).toContain('مقفول')
    const cover = sentBook().getWorksheet('ملخص')!
    let note = ''
    cover.eachRow((r) => {
      if (String(r.getCell(1).value && (r.getCell(1).value as { text?: string }).text) === 'فيلا شامل')
        note = String(r.getCell(3).value)
    })
    expect(note).toBe('شغال')
  })

  it('still makes a tab for a project with no entries', async () => {
    await downloadBackup('u1')
    expect(sentBook().getWorksheet('فاضي')).toBeTruthy()
  })

  it('leaves the main entries sheet whole and the project column in it', async () => {
    await downloadBackup('u1')
    const ws = sentBook().getWorksheet('القيود')!
    expect((ws.getRow(1).values as unknown[]).slice(1)).toContain('المشروع')
    expect(rowsOf('القيود').map((r) => r[0])).toEqual([20260001, 20260002, 20260003, 20260004])
  })
})
