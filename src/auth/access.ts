import type { Level, Module } from './permissions'

/** Who may open a page: a role gate (admin only / admin and owner / owner only) and/or a page permission. */
export type Access = { role?: 'admin' | 'staff' | 'owner'; module?: Module }

export type AccessContext = {
  isAdmin: boolean
  isStaff: boolean
  isOwner: boolean
  can: (module: Module, level?: Level) => boolean
}

/** 'not-found' hides the page completely (wrong role); 'no-access' means the person was not granted the page. */
export type AccessResult = 'ok' | 'not-found' | 'no-access'

export function checkAccess(access: Access | undefined, ctx: AccessContext): AccessResult {
  if (!access) return 'ok'
  if (access.role === 'admin' && !ctx.isAdmin) return 'not-found'
  if (access.role === 'staff' && !ctx.isStaff) return 'not-found'
  if (access.role === 'owner' && !ctx.isOwner) return 'not-found'
  if (access.module && !ctx.can(access.module)) return 'no-access'
  return 'ok'
}
