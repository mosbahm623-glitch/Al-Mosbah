import { KIND_LABEL, totalsOfDay, type Movement } from './movements'
import { dateText } from './format'
import { MONEY, SOFT_FILL, border, downloadWorkbook, header, solid } from './excelCommon'

type Options = { day: string; rows: Movement[]; withContractor: boolean; withBank: boolean; withNotes: boolean }

/** One day's journal as a workbook: every movement, then the totals per kind. */
export async function exportJournalExcel({ day, rows, withContractor, withBank: bankWanted, withNotes }: Options) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()

  const withBank = bankWanted && rows.some((m) => m.detail)
  const ws = wb.addWorksheet(`يومية ${dateText(day)}`, { properties: { tabColor: { argb: 'FFC74634' } } })
  const cols: { h: string; w: number; get: (m: Movement) => string | number }[] = [
    { h: 'رقم القيد', w: 11, get: (m) => m.seq ?? '' },
    { h: 'النوع', w: 16, get: (m) => KIND_LABEL[m.kind] + (m.fromAdvance ? ' (من عهدة)' : '') },
    { h: 'البيان', w: 34, get: (m) => m.title },
    { h: 'المشروع', w: 24, get: (m) => m.project ?? '' },
    ...(withContractor ? [{ h: 'المقاول / العهدة', w: 24, get: (m: Movement) => m.party ?? '' }] : []),
    ...(withBank ? [{ h: 'البنك', w: 18, get: (m: Movement) => m.detail ?? '' }] : []),
    ...(withNotes ? [{ h: 'ملاحظات', w: 30, get: (m: Movement) => m.notes ?? '' }] : []),
    { h: 'المبلغ', w: 16, get: (m) => m.amount },
  ]
  const amountCol = cols.length
  ws.columns = cols.map((c) => ({ width: c.w }))
  header(ws.addRow(cols.map((c) => c.h)))
  for (const m of rows) {
    const r = ws.addRow(cols.map((c) => c.get(m)))
    r.getCell(amountCol).numFmt = MONEY
    r.eachCell((c) => {
      c.border = border
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: Number(c.col) === amountCol ? 'left' : undefined }
    })
  }

  const t = totalsOfDay(rows)
  ws.addRow([])
  const lines: [string, number][] = [
    ['إجمالي الوارد', t.income],
    ['إجمالي المصروف', t.expense],
    ['منه مدفوع من عهدة', t.expense - t.cashExpense],
    ['دفعات عهد', t.installment],
    ['مرتجع عهد', t.return],
    ['مستحقات مقاولين', t.due],
    ['مدفوعات مقاولين', t.payment],
  ]
  for (const [label, value] of lines) {
    const r = ws.addRow([label])
    r.getCell(amountCol).value = value
    ws.mergeCells(r.number, 1, r.number, amountCol - 1)
    r.getCell(amountCol).numFmt = MONEY
    r.eachCell({ includeEmpty: true }, (c) => {
      c.font = { bold: true }
      c.fill = solid(SOFT_FILL)
      c.border = border
    })
  }

  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: 1 }]
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:1' }
  ws.headerFooter.oddFooter = '&Cصفحة &P من &N'

  await downloadWorkbook(wb, `المصباح - يومية ${day}.xlsx`)
}
