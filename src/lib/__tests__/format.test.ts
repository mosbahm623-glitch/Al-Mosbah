import { describe, expect, it } from 'vitest'
import { TYPE_LABEL, dateText, money, periodText, todayISO, todayText } from '../format'

describe('money', () => {
  it('uses latin digits with at most two decimals', () => {
    expect(money(1234.5)).toMatch(/1.?234[.,٫]5/)
    expect(money(0)).toBe('0')
    expect(money(1.239)).toMatch(/1[.,٫]24/)
  })
  it('never shows Arabic-Indic digits', () => {
    expect(money(9876543.21)).not.toMatch(/[٠-٩]/)
  })
})

describe('dateText', () => {
  it('flips ISO to day-month-year', () => {
    expect(dateText('2026-10-30')).toBe('30-10-2026')
  })
})

describe('periodText', () => {
  it('covers both ends, one end, or neither', () => {
    expect(periodText('2026-10-01', '2026-10-28')).toBe('من 01-10-2026 إلى 28-10-2026')
    expect(periodText('2026-10-01', '')).toBe('من 01-10-2026')
    expect(periodText('', '2026-10-28')).toBe('إلى 28-10-2026')
    expect(periodText('', '')).toBe('كل الفترات')
  })
})

describe('today helpers', () => {
  it('todayISO is YYYY-MM-DD', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
  it('todayText is DD-MM-YYYY and is todayISO reversed', () => {
    expect(todayText()).toMatch(/^\d{2}-\d{2}-\d{4}$/)
    expect(todayText()).toBe(dateText(todayISO()))
  })
})

describe('TYPE_LABEL', () => {
  it('names both project types', () => {
    expect(TYPE_LABEL).toEqual({ finishing: 'تشطيب', furnishing: 'فرش' })
  })
})
