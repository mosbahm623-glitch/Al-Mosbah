import { describe, expect, it } from 'vitest'
import { MODULES, allows, type Permissions } from '../../auth/permissions'

describe('allows', () => {
  const perms: Permissions = { projects: 'edit', advances: 'view' }

  it('lets an admin do everything, even with no permissions', () => {
    for (const m of MODULES) {
      expect(allows(true, {}, m.id)).toBe(true)
      expect(allows(true, {}, m.id, 'edit')).toBe(true)
    }
  })
  it('lets edit users view and edit', () => {
    expect(allows(false, perms, 'projects')).toBe(true)
    expect(allows(false, perms, 'projects', 'edit')).toBe(true)
  })
  it('lets view users view but not edit', () => {
    expect(allows(false, perms, 'advances')).toBe(true)
    expect(allows(false, perms, 'advances', 'edit')).toBe(false)
  })
  it('keeps everything else closed, and view is the default level', () => {
    expect(allows(false, perms, 'banks')).toBe(false)
    expect(allows(false, perms, 'banks', 'edit')).toBe(false)
    expect(allows(false, {}, 'dashboard')).toBe(false)
  })
})

describe('MODULES', () => {
  it('has unique ids', () => {
    const ids = MODULES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
