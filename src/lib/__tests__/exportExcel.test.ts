import type { Workbook, Worksheet } from 'exceljs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../excelCommon', async (original) => ({
  ...(await original<typeof import('../excelCommon')>()),
  downloadWorkbook: vi.fn(async () => {}),
}))

import { MONEY, downloadWorkbook, toDate } from '../excelCommon'
import { exportJournalExcel } from '../exportJournalExcel'
import { exportTableExcel } from '../exportTableExcel'
import type { Movement } from '../movements'
import type { Section } from '../tableTypes'

const download = vi.mocked(downloadWorkbook)
beforeEach(() => download.mockClear())

/** The workbook and file name the export handed to the browser. */
const sent = () => {
  expect(download).toHaveBeenCalledTimes(1)
  const [wb, filename] = download.mock.calls[0]
  return { wb: wb as Workbook, filename: filename as string }
}
/** Every row of a sheet as plain values. */
const grid = (ws: Worksheet) => {
  const rows: unknown[][] = []
  ws.eachRow({ includeEmpty: true }, (row) => {
    rows.push((row.values as unknown[]).slice(1))
  })
  return rows
}

describe('toDate', () => {
  it('is UTC midnight, so Excel shows the same day in any time zone', () => {
    expect(toDate('2026-10-30').toISOString()).toBe('2026-10-30T00:00:00.000Z')
  })
})

describe('exportTableExcel', () => {
  const section: Section = {
    heading: 'المصروفات',
    cols: [{ h: 'البيان' }, { h: 'التاريخ', kind: 'date' }, { h: 'المبلغ', kind: 'money' }],
    rows: [
      ['سيراميك', '2026-10-01', 1500.5],
      ['عمالة', '2026-10-02', 800],
    ],
    footer: ['الإجمالي', null, 2300.5],
  }
  const base = {
    title: 'تقرير المشروع',
    sheet: 'تقرير',
    filename: 'r.xlsx',
    meta: [{ label: 'المشروع', value: 'فيلا 5' }],
  }

  it('hands the browser the file name it was given', async () => {
    await exportTableExcel({ ...base, sections: [section] })
    expect(sent().filename).toBe('r.xlsx')
  })

  it('starts with the title and the summary line', async () => {
    await exportTableExcel({ ...base, sections: [section] })
    const ws = sent().wb.worksheets[0]
    expect(ws.getRow(1).getCell(1).value).toBe('المصباح — تقرير المشروع')
    expect(String(ws.getRow(2).getCell(1).value)).toContain('المشروع: فيلا 5')
    expect(String(ws.getRow(2).getCell(1).value)).toContain('تاريخ التقرير:')
  })

  it('writes the header, the rows and the totals row in order', async () => {
    await exportTableExcel({ ...base, sections: [section] })
    const rows = grid(sent().wb.worksheets[0])
    const at = rows.findIndex((r) => r[0] === 'البيان')
    expect(at).toBeGreaterThan(-1)
    expect(rows[at - 1][0]).toBe('المصروفات')
    expect(rows[at + 1][0]).toBe('سيراميك')
    expect(rows[at + 1][2]).toBe(1500.5)
    expect(rows[at + 2][0]).toBe('عمالة')
    expect(rows[at + 3][0]).toBe('الإجمالي')
    expect(rows[at + 3][2]).toBe(2300.5)
  })

  it('stores dates as real dates and amounts with a money format', async () => {
    await exportTableExcel({ ...base, sections: [section] })
    const ws = sent().wb.worksheets[0]
    const rows = grid(ws)
    const first = ws.getRow(rows.findIndex((r) => r[0] === 'سيراميك') + 1)
    expect(first.getCell(2).value).toEqual(toDate('2026-10-01'))
    expect(first.getCell(2).numFmt).toBe('dd-mm-yyyy')
    expect(first.getCell(3).numFmt).toBe(MONEY)
  })

  it('shows the empty message instead of leaving a table with no rows', async () => {
    await exportTableExcel({ ...base, sections: [{ ...section, rows: [], footer: undefined, empty: 'لا مصروفات.' }] })
    expect(grid(sent().wb.worksheets[0]).some((r) => r[0] === 'لا مصروفات.')).toBe(true)
  })

  it('lists the summary cards when there are any', async () => {
    await exportTableExcel({ ...base, kpis: [{ label: 'الرصيد', value: '500' }], sections: [section] })
    expect(grid(sent().wb.worksheets[0]).some((r) => r[0] === 'الرصيد' && r[1] === '500')).toBe(true)
  })

  it('makes a safe sheet name: no forbidden characters, at most 30 characters', async () => {
    await exportTableExcel({ ...base, sheet: 'تقرير/المشروع: [فيلا]؟ ' + 'x'.repeat(40), sections: [section] })
    const name = sent().wb.worksheets[0].name
    expect(name).not.toMatch(/[\\/*?:[\]]/)
    expect(name.length).toBeLessThanOrEqual(30)
  })

  it('reads right to left and prints on one page width', async () => {
    await exportTableExcel({ ...base, sections: [section] })
    const ws = sent().wb.worksheets[0]
    expect(ws.views[0]).toMatchObject({ rightToLeft: true })
    expect(ws.pageSetup).toMatchObject({ orientation: 'landscape', fitToWidth: 1 })
  })
})

const move = (over: Partial<Movement>): Movement => ({
  key: 'k',
  kind: 'expense',
  date: '2026-10-30',
  at: '2026-10-30T10:00:00Z',
  amount: 100,
  category: 'بلاط',
  title: 'سيراميك',
  project: 'فيلا 5',
  party: 'أحمد',
  detail: 'البنك الأهلي',
  notes: 'ملحوظة',
  seq: 1,
  fromAdvance: false,
  status: 'approved',
  ...over,
})

describe('exportJournalExcel', () => {
  const rows = [
    move({ key: '1', kind: 'income', amount: 1000, title: 'دفعة عميل', seq: 1 }),
    move({ key: '2', kind: 'expense', amount: 300, title: 'سيراميك', seq: 2 }),
    move({ key: '3', kind: 'expense', amount: 50, title: 'مواصلات', seq: 3, fromAdvance: true }),
  ]
  const all = { day: '2026-10-30', rows, withContractor: true, withBank: true, withNotes: true }
  const headerOf = (ws: Worksheet) => grid(ws)[0]

  it('names the file and the sheet after the day', async () => {
    await exportJournalExcel(all)
    const { wb, filename } = sent()
    expect(filename).toBe('المصباح - يومية 2026-10-30.xlsx')
    expect(wb.worksheets[0].name).toBe('يومية 30-10-2026')
  })

  it('shows every optional column when asked for them', async () => {
    await exportJournalExcel(all)
    expect(headerOf(sent().wb.worksheets[0])).toEqual([
      'رقم القيد',
      'النوع',
      'البند',
      'البيان',
      'المشروع',
      'المقاول / العهدة',
      'البنك',
      'ملاحظات',
      'المبلغ',
    ])
  })

  it('leaves out the columns that were not asked for', async () => {
    await exportJournalExcel({ ...all, withContractor: false, withBank: false, withNotes: false })
    expect(headerOf(sent().wb.worksheets[0])).toEqual(['رقم القيد', 'النوع', 'البند', 'البيان', 'المشروع', 'المبلغ'])
  })

  it('drops the bank column when no movement has a bank, even if asked', async () => {
    await exportJournalExcel({ ...all, rows: rows.map((m) => ({ ...m, detail: null })) })
    expect(headerOf(sent().wb.worksheets[0])).not.toContain('البنك')
  })

  it('marks an expense paid from a custody', async () => {
    await exportJournalExcel(all)
    const types = grid(sent().wb.worksheets[0]).map((r) => r[1])
    expect(types).toContain('مصروف (من عهدة)')
  })

  it('ends with the totals of the day, without counting custody-paid expenses as cash out twice', async () => {
    await exportJournalExcel(all)
    const ws = sent().wb.worksheets[0]
    const amountCol = headerOf(ws).length
    const value = (label: string) => {
      const row = grid(ws).findIndex((r) => r[0] === label)
      expect(row).toBeGreaterThan(-1)
      return ws.getRow(row + 1).getCell(amountCol).value
    }
    expect(value('إجمالي الوارد')).toBe(1000)
    expect(value('إجمالي المصروف')).toBe(350)
    expect(value('منه مدفوع من عهدة')).toBe(50)
    expect(ws.getRow(grid(ws).findIndex((r) => r[0] === 'إجمالي الوارد') + 1).getCell(amountCol).numFmt).toBe(MONEY)
  })

  it('freezes the header row and reads right to left', async () => {
    await exportJournalExcel(all)
    expect(sent().wb.worksheets[0].views[0]).toMatchObject({ rightToLeft: true, state: 'frozen', ySplit: 1 })
  })
})
