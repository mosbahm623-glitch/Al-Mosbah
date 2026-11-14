import { describe, expect, it } from 'vitest'
import { knownBankLogo } from '../bankLogos'

describe('knownBankLogo', () => {
  it('matches the known banks by name', () => {
    expect(knownBankLogo('البنك الأهلي المصري')).toMatch(/nbe\.png$/)
    expect(knownBankLogo('Al Ahly')).toMatch(/nbe\.png$/)
    expect(knownBankLogo('CIB شركات')).toMatch(/cib-corp\.png$/)
    expect(knownBankLogo('البنك التجاري الدولي')).toMatch(/cib\.png$/)
    expect(knownBankLogo('Cash')).toMatch(/cash\.png$/)
    expect(knownBankLogo('كاش')).toMatch(/cash\.png$/)
  })
  it('returns null for other banks', () => {
    expect(knownBankLogo('بنك مصر')).toBeNull()
  })
})
