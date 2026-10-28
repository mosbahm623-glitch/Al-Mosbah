import { describe, expect, it } from 'vitest'
import { checkAccess, type AccessContext } from '../../auth/access'
import { matchRoute } from '../../layout/routes'
import { ALL_ITEMS } from '../../layout/nav'

const ctx = (over: Partial<AccessContext> = {}): AccessContext => ({ isAdmin: false, isStaff: false, isOwner: false, can: () => false, ...over })
const ID = '0b9f5c3e-6d0e-4a52-9a3f-2f6c1d7e8a90'

describe('checkAccess', () => {
  it('lets everyone in when a page has no rule', () => {
    expect(checkAccess(undefined, ctx())).toBe('ok')
  })
  it('hides role-gated pages from the wrong role', () => {
    expect(checkAccess({ role: 'admin' }, ctx({ isStaff: true, isOwner: true }))).toBe('not-found')
    expect(checkAccess({ role: 'staff' }, ctx())).toBe('not-found')
    expect(checkAccess({ role: 'owner' }, ctx({ isAdmin: true, isStaff: true }))).toBe('not-found')
    expect(checkAccess({ role: 'admin' }, ctx({ isAdmin: true }))).toBe('ok')
    expect(checkAccess({ role: 'staff' }, ctx({ isStaff: true }))).toBe('ok')
    expect(checkAccess({ role: 'owner' }, ctx({ isOwner: true }))).toBe('ok')
  })
  it('asks for the page permission otherwise', () => {
    expect(checkAccess({ module: 'banks' }, ctx())).toBe('no-access')
    expect(checkAccess({ module: 'banks' }, ctx({ can: (m) => m === 'banks' }))).toBe('ok')
  })
})

describe('routes', () => {
  it('matches fixed pages and pages with an id', () => {
    expect(matchRoute('dashboard')?.id).toBe('')
    expect(matchRoute(`projects/${ID}`)?.id).toBe(ID)
    expect(matchRoute(`projects/${ID}/report`)?.id).toBe(ID)
    expect(matchRoute(`advances/${ID}/report`)?.id).toBe(ID)
  })
  it('does not match unknown addresses or malformed ids', () => {
    expect(matchRoute('nope')).toBeNull()
    expect(matchRoute('projects/not-a-uuid')).toBeNull()
    expect(matchRoute(`projects/${ID}/extra`)).toBeNull()
  })
  it('has a page for every menu item', () => {
    for (const item of ALL_ITEMS) expect(matchRoute(item.path), item.path).not.toBeNull()
  })
})
