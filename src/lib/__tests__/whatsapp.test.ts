import { describe, expect, it } from 'vitest'
import { reportSummaryText, whatsappLink } from '../whatsapp'

describe('whatsappLink', () => {
  it('turns a local Egyptian mobile into an international number', () => {
    expect(whatsappLink('hi', '010 1234 5678')).toBe('https://wa.me/201012345678?text=hi')
  })
  it('opens the contact picker when there is no number', () => {
    expect(whatsappLink('hi')).toBe('https://wa.me/?text=hi')
  })
  it('encodes Arabic text', () => {
    expect(whatsappLink('تقرير')).toContain(encodeURIComponent('تقرير'))
  })
})

describe('reportSummaryText', () => {
  it('lists title and lines', () => {
    expect(reportSummaryText('تقرير', [{ label: 'الوارد', value: '100' }])).toBe('*تقرير* - المصباح\nالوارد: 100')
  })
})
