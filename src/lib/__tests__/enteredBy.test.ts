import { describe, expect, it } from 'vitest'
import { enteredByOf } from '../enteredBy'

describe('enteredByOf', () => {
  it('prefers the profile name', () => {
    expect(enteredByOf({ creator: { full_name: 'محمود' }, entered_by_name: 'mshukry' })).toBe('محمود')
  })
  it('falls back to the copied name', () => {
    expect(enteredByOf({ creator: null, entered_by_name: 'ibrahim' })).toBe('ibrahim')
    expect(enteredByOf({ creator: { full_name: null }, entered_by_name: 'ibrahim' })).toBe('ibrahim')
  })
  it('is null when nothing is known', () => {
    expect(enteredByOf({})).toBeNull()
    expect(enteredByOf({ creator: null, entered_by_name: null })).toBeNull()
  })
})
