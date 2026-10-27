/** Pages a user can be granted access to (see migration 011). Admins have everything. */
export const MODULES = [
  { id: 'dashboard', label: 'لوحة التحكم' },
  { id: 'projects', label: 'المشاريع' },
  { id: 'advances', label: 'العهد' },
  { id: 'contractors', label: 'مستحقات المقاولين' },
  { id: 'reports', label: 'التقارير والتصدير' },
  { id: 'tools', label: 'الأدوات' },
] as const

export type Module = (typeof MODULES)[number]['id']
export type Level = 'view' | 'edit'
export type Permissions = Partial<Record<Module, Level>>

export const LEVEL_LABEL: Record<Level | 'none', string> = { none: 'مفيش', view: 'مشاهدة', edit: 'تعديل' }

export function allows(isAdmin: boolean, perms: Permissions, module: Module, level: Level = 'view') {
  if (isAdmin) return true
  const have = perms[module]
  return level === 'view' ? Boolean(have) : have === 'edit'
}
