import type { Row, Workbook } from 'exceljs'

export const INK = 'FF161513'
export const HEAD_FILL = 'FF312D2A'
export const SOFT_FILL = 'FFF3EFEB'
export const MONEY = '#,##0.00'
export const solid = (argb: string) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const
const thin = { style: 'thin', color: { argb: 'FFDEDAD6' } } as const
export const border = { top: thin, left: thin, bottom: thin, right: thin }

// UTC midnight, so Excel shows the same calendar day in any time zone
export const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`)

/** Dark header row used by every sheet. */
export const header = (row: Row) => {
  row.height = 24
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = solid(HEAD_FILL)
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = border
  })
}

/** Hands the workbook to the browser as a download. */
export async function downloadWorkbook(wb: Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
