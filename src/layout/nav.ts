import type { Module } from '../auth/permissions'
import {
  Bell,
  CheckSquare,
  FileBarChart,
  HandCoins,
  History,
  Landmark,
  PlusCircle,
  HardHat,
  LayoutDashboard,
  FolderKanban,
  Search,
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
      { path: 'projects', label: 'المشاريع', icon: FolderKanban, module: 'projects' },
      { path: 'advances', label: 'العهد', icon: HandCoins, module: 'advances' },
      { path: 'banks', label: 'البنوك', icon: Landmark, module: 'banks' },
      { path: 'contractors', label: 'مستحقات المقاولين', icon: HardHat, module: 'contractors' },
      { path: 'approvals', label: 'الموافقات', icon: CheckSquare, adminOnly: true },
      { path: 'users', label: 'المستخدمين', icon: Users, staffOnly: true },
      { path: 'reports', label: 'التقارير والتصدير', icon: FileBarChart, module: 'reports' },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { path: 'search', label: 'بحث في القيود', icon: Search, module: 'tools' },
      { path: 'recent', label: 'آخر التحركات', icon: History, module: 'tools' },
      { path: 'notifications', label: 'إشعارات', icon: Bell, module: 'tools' },
    ],
  },
]

export const ALL_ITEMS = NAV.flatMap((g) => g.items)
