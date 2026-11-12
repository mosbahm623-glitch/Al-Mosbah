import { describe, expect, it } from 'vitest'
import { parseCommand, plain, takeAmount } from '../voiceCommand'

const projects = [
  { id: '1', name: 'العيادة' },
  { id: '2', name: 'ا/احمد الجندي' },
  { id: '3', name: 'مشروع شاليا' },
]
const cats = ['نقاشة', 'كهرباء', 'نجارة']

describe('plain / takeAmount', () => {
  it('turns Arabic digits and spelling variants into one form', () => {
    expect(plain('٥٠٠ جنيه، العياده')).toBe('500 جنيه العيادة'.replace('ة', 'ه'))
  })
  it('reads thousands and millions', () => {
    expect(takeAmount('30 الف خالد').amount).toBe(30000)
    expect(takeAmount('500 نقاشه').amount).toBe(500)
    expect(takeAmount('الفين نقاشه').amount).toBe(2000)
    expect(takeAmount('بدون رقم').amount).toBeNull()
  })
})

describe('parseCommand: entries', () => {
  it('reads amount, category, project', () => {
    const c = parseCommand('سجّل ٥٠٠ جنيه نقاشة على الجندي', projects, cats)
    expect(c).toMatchObject({ intent: 'entry', kind: 'expense', amount: 500, category: 'نقاشة' })
    expect(c.intent === 'entry' && c.project?.id).toBe('2')
  })
  it('knows an income', () => {
    const c = parseCommand('سجل وارد 100 الف على العيادة', projects, cats)
    expect(c).toMatchObject({ intent: 'entry', kind: 'income', amount: 100000 })
    expect(c.intent === 'entry' && c.project?.id).toBe('1')
  })
  it('keeps the rest as the description', () => {
    const c = parseCommand('سجل 1200 كهرباء لمبات وكابلات على شاليا', projects, cats)
    expect(c.intent === 'entry' && c.text).toBe('كهرباء لمبات وكابلات')
  })
  it('leaves the project empty when none is named', () => {
    const c = parseCommand('سجل 300 نقاشة', projects, cats)
    expect(c.intent === 'entry' && c.project).toBeNull()
  })
})

describe('parseCommand: questions', () => {
  it('asks about expenses of a project', () => {
    const c = parseCommand('كام صرفنا على العيادة؟', projects)
    expect(c).toMatchObject({ intent: 'query', metric: 'expenses' })
    expect(c.intent === 'query' && c.project?.id).toBe('1')
  })
  it('asks for a balance', () => {
    expect(parseCommand('رصيد الجندي', projects)).toMatchObject({ intent: 'query', metric: 'balance' })
  })
  it('asks about income of everything', () => {
    const c = parseCommand('كام الوارد', projects)
    expect(c).toMatchObject({ intent: 'query', metric: 'income', project: null })
  })
  it('does not guess at anything else', () => {
    expect(parseCommand('صباح الخير', projects)).toEqual({ intent: 'unknown' })
    expect(parseCommand('', projects)).toEqual({ intent: 'unknown' })
  })
})
