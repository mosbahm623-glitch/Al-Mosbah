import { describe, expect, it } from 'vitest'
import { footerSpan, isNumericCol, pillOf, showCell } from '../tableFormat'
import type { Col } from '../tableTypes'

describe('showCell', () => {
  it('shows nothing for null and empty text', () => {
    expect(showCell('text', null)).toBe('')
    expect(showCell('money', '')).toBe('')
  })
  it('formats money and dates by column kind', () => {
    expect(showCell('money', 1500)).toMatch(/1.?500/)
    expect(showCell('date', '2026-10-30')).toBe('30-10-2026')
  })
  it('keeps zero (a real amount) visible', () => {
    expect(showCell('money', 0)).toBe('0')
    expect(showCell('int', 0)).toBe('0')
  })
  it('falls back to plain text when the value does not fit the kind', () => {
    expect(showCell('money', 'n/a')).toBe('n/a')
    expect(showCell('date', 5)).toBe('5')
  })
})

describe('isNumericCol', () => {
  it('is true for money, int and date only', () => {
    expect(isNumericCol({ h: 'x', kind: 'money' })).toBe(true)
    expect(isNumericCol({ h: 'x', kind: 'int' })).toBe(true)
    expect(isNumericCol({ h: 'x', kind: 'date' })).toBe(true)
    expect(isNumericCol({ h: 'x', kind: 'text' })).toBe(false)
    expect(isNumericCol({ h: 'x' })).toBe(false)
  })
})

describe('footerSpan', () => {
  it('ends the label before the first later cell with a value', () => {
    expect(footerSpan(['الإجمالي', null, null, 500], 4)).toBe(3)
    expect(footerSpan(['الإجمالي', 10, 20], 3)).toBe(1)
  })
  it('spans the whole row when nothing else has a value', () => {
    expect(footerSpan(['الإجمالي', null, ''], 3)).toBe(3)
  })
  it('counts zero as a value', () => {
    expect(footerSpan(['الإجمالي', null, 0], 3)).toBe(2)
  })
})

describe('pillOf', () => {
  const col: Col = { h: 'الحالة', pill: (v) => (v === 'تم' ? 'ok' : 'warn') }
  it('asks the column for the tone', () => {
    expect(pillOf(col, 'تم')).toBe('ok')
    expect(pillOf(col, 'معلّق')).toBe('warn')
  })
  it('gives none for empty cells or columns without pills', () => {
    expect(pillOf(col, null)).toBeUndefined()
    expect(pillOf(col, '')).toBeUndefined()
    expect(pillOf({ h: 'x' }, 'تم')).toBeUndefined()
  })
})
