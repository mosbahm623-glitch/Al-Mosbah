import type { ProjectSummary } from './projects'
import { TYPE_LABEL, todayISO, todayText } from './format'
import { balanceOf, totalsOf } from './reports'
import { HEAD_FILL, MONEY, SOFT_FILL, border, downloadWorkbook, header, solid } from './excelCommon'

type Options = { rows: ProjectSummary[]; scope: string }

/** Builds the all-projects summary workbook in the browser and downloads it. exceljs is loaded only when this runs. */
export async function exportAggregateExcel({ rows, scope }: Options) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()

  const ws = wb.addWorksheet('ملخص المشاريع', { properties: { tabColor: { argb: 'FFC74634' } } })
  const widths = [6, 34, 10, 10, 16, 16, 16, 16, 14]
  ws.columns = widths.map((width) => ({ width }))

  ws.mergeCells('A1:I1')
  const title = ws.getCell('A1')
  title.value = 'المصباح — تقرير مجمّع للمشاريع'
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  title.fill = solid(HEAD_FILL)
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  ws.getRow(1).height = 34
  ws.mergeCells('A2:I2')
  ws.getCell('A2').value = `${scope} · تاريخ التقرير ${todayText()}`
  ws.getCell('A2').alignment = { horizontal: 'center' }

  const headRow = 4
  ws.getRow(headRow).values = ['م', 'المشروع', 'النوع', 'الحالة', 'الميزانية', 'الوارد', 'المصروف', 'الرصيد', 'استهلاك الميزانية']
  header(ws.getRow(headRow))

  const first = headRow + 1
  rows.forEach((p, i) => {
    const n = first + i
    const balance = balanceOf(p)
    const r = ws.addRow([
      i + 1,
      p.name,
      TYPE_LABEL[p.type],
      p.status === 'active' ? 'نشط' : 'مقفول',
      p.budget,
      p.income,
      p.expenses,
      { formula: `F${n}-G${n}`, result: balance },
      p.budget > 0 ? { formula: `G${n}/E${n}`, result: p.expenses / p.budget } : '—',
    ])
    for (const c of [5, 6, 7, 8]) r.getCell(c).numFmt = MONEY
    if (p.budget > 0) r.getCell(9).numFmt = '0%'
    if (balance < 0) r.getCell(8).font = { color: { argb: 'FFA8342A' }, bold: true }
    if (p.budget > 0 && p.expenses > p.budget) r.getCell(9).font = { color: { argb: 'FFA8342A' }, bold: true }
    r.eachCell((c) => {
      c.border = border
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: Number(c.col) >= 5 ? 'left' : undefined }
    })
  })

  const last = first + rows.length - 1
  const t = totalsOf(rows)
  const total = ws.addRow(['', `الإجمالي (${t.count} مشروع)`, '', ''])
  const sum = (col: string, result: number) => ({ formula: rows.length ? `SUM(${col}${first}:${col}${last})` : '0', result })
  total.getCell(5).value = sum('E', t.budget)
  total.getCell(6).value = sum('F', t.income)
  total.getCell(7).value = sum('G', t.expenses)
  total.getCell(8).value = { formula: `F${total.number}-G${total.number}`, result: t.balance }
  total.getCell(9).value = t.budget > 0 ? { formula: `G${total.number}/E${total.number}`, result: t.expenses / t.budget } : '—'
  for (const c of [5, 6, 7, 8]) total.getCell(c).numFmt = MONEY
  if (t.budget > 0) total.getCell(9).numFmt = '0%'
  total.eachCell({ includeEmpty: true }, (c) => {
    c.font = { bold: true }
    c.fill = solid(SOFT_FILL)
    c.border = border
    if (Number(c.col) >= 5) c.alignment = { horizontal: 'left' }
  })

  ws.autoFilter = { from: { row: headRow, column: 1 }, to: { row: headRow, column: 9 } }
  ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: headRow }]
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headRow}:${headRow}` }
  ws.headerFooter.oddFooter = '&Cصفحة &P من &N'

  await downloadWorkbook(wb, `المصباح - تقرير مجمّع - ${todayISO()}.xlsx`)
}
