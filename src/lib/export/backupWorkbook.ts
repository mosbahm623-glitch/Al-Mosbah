import type { Workbook } from 'exceljs'
import { HEAD_FILL, INK, MONEY, SOFT_FILL, border, downloadWorkbook, header, solid, toDate } from './excelCommon'
import { todayISO } from '../core/format'
import { day, type Sheet } from './backupTypes'

/** Lays the prepared sheets out as one Arabic (right-to-left) Excel workbook. */
export async function buildBackupWorkbook(sheets: Sheet[]): Promise<Workbook> {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Legacy ERP'
  wb.created = new Date()

  const cover = wb.addWorksheet('ملخص', { views: [{ rightToLeft: true, showGridLines: false }] })
  cover.columns = [{ width: 30 }, { width: 16 }]
  const title = cover.addRow(['Legacy ERP — نسخة احتياطية'])
  cover.mergeCells(1, 1, 1, 2)
  title.height = 36
  title.getCell(1).font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } }
  title.getCell(1).fill = solid(HEAD_FILL)
  title.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  const meta = cover.addRow([
    'تاريخ النسخة',
    new Date().toLocaleString('ar-EG', { dateStyle: 'long', timeStyle: 'short' }),
  ])
  meta.getCell(1).font = { bold: true }
  cover.addRow([])
  header(cover.addRow(['الورقة', 'عدد الصفوف']))
  for (const s of sheets) {
    const r = cover.addRow([s.name, s.rows.length])
    r.eachCell((c) => {
      c.border = border
    })
    r.getCell(1).value = { text: s.name, hyperlink: `#'${s.name}'!A1` }
    r.getCell(1).font = { color: { argb: 'FF1F5FA8' }, underline: true }
  }

  const fmt = { money: MONEY, int: '0', date: 'yyyy-mm-dd', time: 'yyyy-mm-dd hh:mm' } as const
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
      properties: { tabColor: { argb: s.tab ?? (s.name === 'القيود المحذوفة' ? 'FFC74634' : 'FF312D2A') } },
    })
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
    ws.columns = s.cols.map((c) => ({
      width: c.w ?? (c.kind === 'money' ? 16 : c.kind === 'date' ? 13 : c.kind === 'time' ? 19 : 14),
    }))
    header(ws.addRow(s.cols.map((c) => c.h)))
    s.rows.forEach((r, i) => {
      const row = ws.addRow(
        s.cols.map((c) => {
          const v = c.get(r)
          if (v == null || v === '') return null
          if (c.kind === 'money' || c.kind === 'int') return Number(v)
          if (c.kind === 'date') return toDate(day(v))
          if (c.kind === 'time') return new Date(String(v))
          return String(v)
        }),
      )
      row.eachCell({ includeEmpty: true }, (cell, n) => {
        const c = s.cols[n - 1]
        cell.border = border
        cell.alignment = {
          vertical: 'middle',
          horizontal:
            c.kind === 'money' || c.kind === 'int' || c.kind === 'date' || c.kind === 'time' ? 'center' : 'right',
          wrapText: false,
        }
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
      tot.eachCell((c) => {
        c.font = { bold: true }
        c.fill = solid(SOFT_FILL)
        c.border = border
        c.alignment = { horizontal: 'center' }
      })
    }
  }

  return wb
}

/** Builds the workbook and downloads it. */
export async function writeBackupWorkbook(sheets: Sheet[]): Promise<void> {
  await downloadWorkbook(await buildBackupWorkbook(sheets), `Legacy ERP-نسخة-احتياطية-${todayISO()}.xlsx`)
}
