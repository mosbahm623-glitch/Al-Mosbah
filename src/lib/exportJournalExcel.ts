import { KIND_LABEL, totalsOfDay, type Movement } from './movements'
import { dateText } from './format'
import { MONEY, SOFT_FILL, border, downloadWorkbook, header, solid } from './excelCommon'

/** One day's journal as a workbook: every movement, then the totals per kind. */
export async function exportJournalExcel({ day, rows }: { day: string; rows: Movement[] }) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()

  const ws = wb.addWorksheet(`يومية ${dateText(day)}`, { properties: { tabColor: { argb: 'FFC74634' } } })
  const cols = [
    { h: 'رقم القيد', w: 11 },
    { h: 'النوع', w: 14 },
    { h: 'البيان', w: 34 },
    { h: 'المشروع', w: 24 },
    { h: 'المقاول / صاحب العهدة', w: 24 },
    { h: 'البنك', w: 18 },
    { h: 'ملاحظات', w: 30 },
    { h: 'المبلغ', w: 16 },
  ]
  ws.columns = cols.map((c) => ({ width: c.w }))
  header(ws.addRow(cols.map((c) => c.h)))
  for (const m of rows) {
    const r = ws.addRow([
      m.seq ?? '',
      KIND_LABEL[m.kind] + (m.fromAdvance ? ' (من عهدة)' : ''),
      m.title,
      m.project ?? '',
      m.party ?? '',
      m.detail ?? '',
      m.notes ?? '',
      m.amount,
    ])
    r.getCell(8).numFmt = MONEY
    r.eachCell((c) => {
      c.border = border
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: Number(c.col) === 8 ? 'left' : undefined }
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
    const r = ws.addRow([label, '', '', '', '', '', '', value])
    ws.mergeCells(r.number, 1, r.number, 7)
    r.getCell(8).numFmt = MONEY
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
