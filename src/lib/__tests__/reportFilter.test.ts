import { describe, expect, it } from 'vitest'
import { NO_FILTER, filterMeta, matches, only } from '../reportFilter'

describe('report filters', () => {
  const f = { ...NO_FILTER, project: 'أ', category: 'سباكة' }

  it('keeps a row only when it passes every filter that is set', () => {
    expect(matches(f, { project: 'أ', category: 'سباكة' })).toBe(true)
    expect(matches(f, { project: 'ب', category: 'سباكة' })).toBe(false)
    expect(matches(NO_FILTER, { project: null })).toBe(true)
  })

  it('ignores a filter for a field the row does not have, but drops rows with an empty one', () => {
    expect(matches(f, { project: 'أ' })).toBe(true)
    expect(matches(f, { project: 'أ', category: null })).toBe(false)
  })

  it('clears the filters a report does not offer and describes the rest', () => {
    expect(only(f, ['project'])).toEqual({ ...NO_FILTER, project: 'أ' })
    expect(filterMeta(f)).toEqual([
      { label: 'المشروع', value: 'أ' },
      { label: 'البند', value: 'سباكة' },
    ])
  })
})
