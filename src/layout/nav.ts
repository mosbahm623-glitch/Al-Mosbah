import type { Module } from '../lib/users/permissions'
import {
  Bell,
  CheckSquare,
  DatabaseBackup,
  FileBarChart,
  HandCoins,
  History,
  Landmark,
  PlusCircle,
  HardHat,
  LayoutDashboard,
  Merge,
  Mic,
  FolderKanban,
  Search,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  /** only the admin (approvals) */
  adminOnly?: boolean
  /** admin and owner */
  staffOnly?: boolean
  /** the owner only */
  ownerOnly?: boolean
  /** visible only to users who were granted this page */
  module?: Module
}

type NavGroup = { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    items: [
      { path: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, module: 'dashboard' },
      { path: 'quick-entry', label: 'تسجيل قيد سريع', icon: PlusCircle, ownerOnly: true },
      { path: 'voice-entry', label: 'التسجيل بالصوت', icon: Mic, adminOnly: true },
      { path: 'projects', label: 'المشاريع', icon: FolderKanban, module: 'projects' },
      { path: 'advances', label: 'العهد', icon: HandCoins, module: 'advances' },
      { path: 'banks', label: 'البنوك', icon: Landmark, module: 'banks' },
      { path: 'contractors', label: 'مستحقات المقاولين', icon: HardHat, module: 'contractors' },
      { path: 'approvals', label: 'الموافقات', icon: CheckSquare, adminOnly: true },
      { path: 'users', label: 'المستخدمين', icon: Users, staffOnly: true },
      { path: 'reports', label: 'التقارير والتصدير', icon: FileBarChart, module: 'reports' },
      { path: 'backup', label: 'النسخة الاحتياطية', icon: DatabaseBackup, staffOnly: true },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { path: 'search', label: 'بحث في القيود', icon: Search, module: 'tools' },
      { path: 'recent', label: 'آخر القيود', icon: History, module: 'tools' },
      { path: 'bulk-invoices', label: 'رفع فواتير بالجملة', icon: Upload, adminOnly: true },
      { path: 'merge-contractors', label: 'توحيد أسماء المقاولين', icon: Merge, adminOnly: true },
      { path: 'merge-categories', label: 'توحيد أسماء البنود', icon: Merge, adminOnly: true },
      { path: 'notifications', label: 'إشعارات', icon: Bell, module: 'tools' },
    ],
  },
]

export const ALL_ITEMS = NAV.flatMap((g) => g.items)

type Who = {
  can: (module: Module) => boolean
  isAdmin: boolean
  isStaff: boolean
  isOwner: boolean
}

/** The pages this person may open (the sidebar and the quick search show the same ones). */
export const visibleItems = (items: NavItem[], who: Who) =>
  items.filter((it) =>
    it.ownerOnly
      ? who.isOwner
      : it.adminOnly
        ? who.isAdmin
        : it.staffOnly
          ? who.isStaff
          : !it.module || who.can(it.module),
  )
