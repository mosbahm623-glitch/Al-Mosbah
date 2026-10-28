import { dateText, money } from './format'
import type { Cell, Col, Tone } from './tableTypes'

/** The text shown for a cell, by the kind of its column. */
export const showCell = (kind: Col['kind'], v: Cell) => {
  if (v === null || v === '') return ''
  if (kind === 'money' && typeof v === 'number') return money(v)
  if (kind === 'date' && typeof v === 'string') return dateText(v)
  return String(v)
}

/** Numbers, money and dates line up to one side. */
export const isNumericCol = (c: Col) => c.kind === 'money' || c.kind === 'int' || c.kind === 'date'

/** Where a footer's label ends: the first later cell with a value (or the whole row when there is none). */
export const footerSpan = (footer: Cell[], colCount: number) => {
  const i = footer.findIndex((v, j) => j > 0 && v !== null && v !== '')
  return i === -1 ? colCount : Math.max(1, i)
}

/** The pill colour of a cell, when its column has pills and the value earns one. */
export const pillOf = (c: Col, v: Cell): Tone | undefined => (v === null || v === '' ? undefined : c.pill?.(v))
