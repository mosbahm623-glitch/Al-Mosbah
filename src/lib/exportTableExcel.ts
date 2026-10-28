import { todayText } from './format'
import type { Kpi } from '../components/PaperExtras'
import type { Section } from '../components/TableReport'
import { HEAD_FILL, MONEY, SOFT_FILL, border, downloadWorkbook, header, solid, toDate } from './excelCommon'

type Options = { title: string; sheet: string; filename: string; meta: { label: string; value: string }[]; kpis?: Kpi[]; sections: Section[] }

/** Any table report as a one-sheet workbook: title, summary lines, then each table with its totals row. */
export async function exportTableExcel({ title, sheet, filename, meta, kpis, sections }: Options) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()
  const ws = wb.addWorksheet(sheet.replace(/[\\/*?:[\]]/g, ' ').slice(0, 30), { properties: { tabColor: { argb: 'FFC74634' } } })

  const width = Math.max(4, ...sections.map((s) => s.cols.length))
  const widths = Array.from({ length: width }, () => 12)
  for (const s of sections) {
    s.cols.forEach((c, i) => {
      const longest = Math.max(c.h.length, ...s.rows.map((r) => String(r[i] ?? '').length), String(s.footer?.[i] ?? '').length)
      widths[i] = Math.min(40, Math.max(widths[i], longest + 3))
    })
  }
  ws.columns = widths.map((w) => ({ width: w }))

  const t = ws.addRow([`المصباح — ${title}`])
  ws.mergeCells(t.number, 1, t.number, width)
  t.height = 34
  t.getCell(1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  t.getCell(1).fill = solid(HEAD_FILL)
  t.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }
  const info = ws.addRow([[...meta.map((m) => `${m.label}: ${m.value}`), `تاريخ التقرير: ${todayText()}`].join('  ·  ')])
  ws.mergeCells(info.number, 1, info.number, width)
  info.getCell(1).alignment = { horizontal: 'center' }

  if (kpis?.length) {
    ws.addRow([])
    for (const k of kpis) {
      const r = ws.addRow([k.label, k.value])
      r.getCell(1).font = { bold: true }
      r.eachCell((c) => {
        c.border = border
        c.fill = solid(SOFT_FILL)
      })
    }
  }

  for (const s of sections) {
    ws.addRow([])
    if (s.heading) ws.addRow([s.heading]).getCell(1).font = { bold: true, size: 13 }
    header(ws.addRow(s.cols.map((c) => c.h)))
    for (const row of s.rows) {
      const r = ws.addRow(row.map((v, i) => (s.cols[i].kind === 'date' && typeof v === 'string' ? toDate(v) : v)))
      s.cols.forEach((c, i) => {
        const cell = r.getCell(i + 1)
        if (c.kind === 'money') cell.numFmt = MONEY
        if (c.kind === 'date') cell.numFmt = 'dd-mm-yyyy'
        if (c.kind === 'money' || c.kind === 'int') cell.alignment = { horizontal: 'left' }
      })
      r.eachCell({ includeEmpty: true }, (c) => {
        c.border = border
        c.alignment = { ...c.alignment, vertical: 'middle', wrapText: true }
      })
    }
    if (s.rows.length === 0) ws.addRow([s.empty ?? 'مفيش بيانات.'])
    if (s.footer) {
      const r = ws.addRow(s.footer)
      s.cols.forEach((c, i) => {
        if (c.kind === 'money') r.getCell(i + 1).numFmt = MONEY
      })
      r.eachCell({ includeEmpty: true }, (c) => {
        c.font = { bold: true }
        c.fill = solid(SOFT_FILL)
        c.border = border
      })
    }
  }

  ws.views = [{ rightToLeft: true }]
  ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  ws.headerFooter.oddFooter = '&Cصفحة &P من &N'
  await downloadWorkbook(wb, filename)
}
