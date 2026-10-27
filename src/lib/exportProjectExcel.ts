import type { Entry, ProjectSummary } from './projects'
import { TYPE_LABEL } from './format'

type Options = { project: ProjectSummary; entries: Entry[]; withContractor: boolean }

const INK = 'FF161513'
const HEAD_FILL = 'FF312D2A'
const SOFT_FILL = 'FFF3EFEB'
const MONEY = '#,##0.00'
const solid = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const
const thin = { style: 'thin', color: { argb: 'FFDEDAD6' } } as const
const border = { top: thin, left: thin, bottom: thin, right: thin }

const sheetName = (name: string, used: Set<string>) => {
  const base = name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 28) || 'بند'
  let out = base
  for (let i = 2; used.has(out); i++) out = `${base} ${i}`
  used.add(out)
  return out
}

// UTC midnight, so Excel shows the same calendar day in any time zone
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** Builds the workbook in the browser and downloads it. exceljs is loaded only when this runs. */
export async function exportProjectExcel({ project, entries, withContractor }: Options) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'المصباح'
  wb.created = new Date()

  const expenses = entries.filter((e) => e.kind === 'expense')
  const incomes = entries.filter((e) => e.kind === 'income')
  const expenseTotal = expenses.reduce((s, e) => s + e.amount, 0)
  const incomeTotal = incomes.reduce((s, e) => s + e.amount, 0)
  const used = new Set<string>(['ملخص', 'كل القيود'])

  const header = (row: import('exceljs').Row) => {
    row.height = 24
    row.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = solid(HEAD_FILL)
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      c.border = border
    })
  }
  const setup = (ws: import('exceljs').Worksheet, headerRow: number) => {
    ws.views = [{ rightToLeft: true, state: 'frozen', ySplit: headerRow }]
    ws.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${headerRow}:${headerRow}` }
    ws.headerFooter.oddFooter = '&Cصفحة &P من &N'
  }

  // sheets are created in tab order: summary (filled last), all entries, then one per بند
  const sum = wb.addWorksheet('ملخص', { properties: { tabColor: { argb: 'FFC74634' } } })

  // ---- كل القيود ----
  const all = wb.addWorksheet('كل القيود')
  const cols = [
    { h: 'رقم القيد', w: 11 },
    { h: 'التاريخ', w: 13 },
    { h: 'النوع', w: 10 },
    { h: 'البند', w: 18 },
    { h: 'اسم المصروف', w: 30 },
    ...(withContractor ? [{ h: 'المقاول', w: 22 }] : []),
    { h: 'ملاحظات', w: 30 },
    { h: 'المبلغ', w: 16 },
  ]
  const amountCol = cols.length
  all.columns = cols.map((c) => ({ width: c.w }))
  header(all.addRow(cols.map((c) => c.h)))
  const sorted = [...entries].sort((a, b) => a.seq - b.seq)
  for (const e of sorted) {
    const r = all.addRow([
      e.seq,
      toDate(e.entry_date),
      e.kind === 'income' ? 'وارد' : 'مصروف',
      e.category,
      e.item ?? '',
      ...(withContractor ? [e.contractor?.name ?? ''] : []),
      e.notes ?? '',
      e.amount,
    ])
    r.getCell(2).numFmt = 'dd-mm-yyyy'
    r.getCell(amountCol).numFmt = MONEY
    r.getCell(amountCol).font = { color: { argb: e.kind === 'income' ? 'FF2E7D57' : 'FFA8342A' }, bold: true }
    r.eachCell((c) => {
      c.border = border
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: Number(c.col) === amountCol ? 'left' : undefined }
    })
  }
  const last = all.rowCount
  const totalRow = all.addRow(Array(amountCol - 1).fill('').concat([null]))
  totalRow.getCell(1).value = 'الإجمالي (الصافي = وارد − مصروف)'
  all.mergeCells(totalRow.number, 1, totalRow.number, amountCol - 1)
  const L = all.getColumn(amountCol).letter
  const net = incomeTotal - expenseTotal
  totalRow.getCell(amountCol).value = { formula: `SUMIF(C2:C${last},"وارد",${L}2:${L}${last})-SUMIF(C2:C${last},"مصروف",${L}2:${L}${last})`, result: net }
  totalRow.getCell(amountCol).numFmt = MONEY
  totalRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: INK } }
    c.fill = solid(SOFT_FILL)
    c.border = border
  })
  all.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: amountCol } }
  setup(all, 1)

  // ---- ورقة لكل بند (مصروفات) ----
  const byCat = new Map<string, Entry[]>()
  for (const e of expenses) byCat.set(e.category, [...(byCat.get(e.category) ?? []), e])
  const catTotals: { name: string; sheet: string; total: number; count: number }[] = []
  for (const [cat, rows] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ar'))) {
    const name = sheetName(cat, used)
    const ws = wb.addWorksheet(name)
    const c2 = [
      { h: 'رقم القيد', w: 11 },
      { h: 'التاريخ', w: 13 },
      { h: 'اسم المصروف', w: 32 },
      ...(withContractor ? [{ h: 'المقاول', w: 24 }] : []),
      { h: 'ملاحظات', w: 32 },
      { h: 'المبلغ', w: 16 },
    ]
    ws.columns = c2.map((c) => ({ width: c.w }))
    header(ws.addRow(c2.map((c) => c.h)))
    const amt = c2.length
    for (const e of [...rows].sort((a, b) => a.seq - b.seq)) {
      const r = ws.addRow([e.seq, toDate(e.entry_date), e.item ?? '', ...(withContractor ? [e.contractor?.name ?? ''] : []), e.notes ?? '', e.amount])
      r.getCell(2).numFmt = 'dd-mm-yyyy'
      r.getCell(amt).numFmt = MONEY
      r.eachCell((c) => {
        c.border = border
        c.alignment = { vertical: 'middle', wrapText: true }
      })
    }
    const lastRow = ws.rowCount
    const t = ws.addRow([])
    t.getCell(1).value = `إجمالي ${cat}`
    ws.mergeCells(t.number, 1, t.number, amt - 1)
    const col = ws.getColumn(amt).letter
    const total = rows.reduce((s, e) => s + e.amount, 0)
    t.getCell(amt).value = { formula: `SUM(${col}2:${col}${lastRow})`, result: total }
    t.getCell(amt).numFmt = MONEY
    t.eachCell((c) => {
      c.font = { bold: true }
      c.fill = solid(SOFT_FILL)
      c.border = border
    })
    setup(ws, 1)
    catTotals.push({ name: cat, sheet: name, total, count: rows.length })
  }

  // ---- ملخص (أول ورقة) ----
  sum.columns = [{ width: 28 }, { width: 20 }, { width: 14 }, { width: 14 }]
  sum.mergeCells('A1:D1')
  const title = sum.getCell('A1')
  title.value = `المصباح — تقرير مشروع: ${project.name}`
  title.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } }
  title.fill = solid(HEAD_FILL)
  title.alignment = { horizontal: 'center', vertical: 'middle' }
  sum.getRow(1).height = 34
  const info: [string, string | number | { formula: string; result: number }][] = [
    ['نوع المشروع', TYPE_LABEL[project.type]],
    ['الحالة', project.status === 'active' ? 'نشط' : 'مقفول'],
    ['تاريخ التقرير', new Date().toLocaleDateString('en-GB').replaceAll('/', '-')],
    ['الميزانية', project.budget],
    ['إجمالي الوارد', { formula: `SUMIF('كل القيود'!C:C,"وارد",'كل القيود'!${L}:${L})`, result: incomeTotal }],
    ['إجمالي المصروف', { formula: `SUMIF('كل القيود'!C:C,"مصروف",'كل القيود'!${L}:${L})`, result: expenseTotal }],
  ]
  info.forEach(([k, v]) => {
    const r = sum.addRow([k, v])
    r.getCell(1).font = { bold: true }
    if (typeof v !== 'string') r.getCell(2).numFmt = MONEY
    r.eachCell((c) => {
      c.border = border
    })
  })
  const first = 3
  const rowOf = (label: string) => first + info.findIndex(([k]) => k === label)
  const bal = sum.addRow(['الرصيد (وارد − مصروف)', { formula: `B${rowOf('إجمالي الوارد')}-B${rowOf('إجمالي المصروف')}`, result: net }])
  bal.getCell(2).numFmt = MONEY
  const pct = sum.addRow(['نسبة استهلاك الميزانية', project.budget > 0 ? { formula: `B${rowOf('إجمالي المصروف')}/B${rowOf('الميزانية')}`, result: expenseTotal / project.budget } : '—'])
  if (project.budget > 0) pct.getCell(2).numFmt = '0%'
  for (const r of [bal, pct]) {
    r.font = { bold: true }
    r.eachCell((c) => {
      c.border = border
      c.fill = solid(SOFT_FILL)
    })
  }
  sum.addRow([])
  const th = sum.addRow(['البند', 'إجمالي المصروف', 'عدد القيود', 'النسبة'])
  header(th)
  const start = sum.rowCount + 1
  for (const c of catTotals.sort((a, b) => b.total - a.total)) {
    const r = sum.addRow([
      { text: c.name, hyperlink: `#'${c.sheet}'!A1` },
      c.total,
      c.count,
      expenseTotal > 0 ? c.total / expenseTotal : 0,
    ])
    r.getCell(2).numFmt = MONEY
    r.getCell(4).numFmt = '0%'
    r.getCell(1).font = { color: { argb: 'FF3D5A80' }, underline: true }
    r.eachCell((x) => {
      x.border = border
    })
  }
  if (catTotals.length) {
    const end = sum.rowCount
    const t = sum.addRow(['الإجمالي', { formula: `SUM(B${start}:B${end})`, result: expenseTotal }, { formula: `SUM(C${start}:C${end})`, result: expenses.length }, ''])
    t.getCell(2).numFmt = MONEY
    t.eachCell((c) => {
      c.font = { bold: true }
      c.fill = solid(SOFT_FILL)
      c.border = border
    })
  }
  sum.views = [{ rightToLeft: true }]
  sum.pageSetup = { orientation: 'portrait', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 }

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `المصباح - ${project.name} - ${new Date().toLocaleDateString('en-CA')}.xlsx`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
