import type { Access } from '../auth/access'
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
  /** who sees this item and may open every page under its path */
  access?: Access
}

type NavGroup = { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    items: [
      { path: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, access: { module: 'dashboard' } },
      { path: 'quick-entry', label: 'تسجيل قيد سريع', icon: PlusCircle, access: { role: 'owner' } },
      { path: 'projects', label: 'المشاريع', icon: FolderKanban, access: { module: 'projects' } },
      { path: 'advances', label: 'العهد', icon: HandCoins, access: { module: 'advances' } },
      { path: 'banks', label: 'البنوك', icon: Landmark, access: { module: 'banks' } },
      { path: 'contractors', label: 'مستحقات المقاولين', icon: HardHat, access: { module: 'contractors' } },
      { path: 'approvals', label: 'الموافقات', icon: CheckSquare, access: { role: 'admin' } },
      { path: 'users', label: 'المستخدمين', icon: Users, access: { role: 'staff' } },
      { path: 'reports', label: 'التقارير والتصدير', icon: FileBarChart, access: { module: 'reports' } },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { path: 'search', label: 'بحث في القيود', icon: Search, access: { module: 'tools' } },
      { path: 'recent', label: 'آخر التحركات', icon: History, access: { module: 'tools' } },
      { path: 'notifications', label: 'إشعارات', icon: Bell, access: { module: 'tools' } },
    ],
  },
]

export const ALL_ITEMS = NAV.flatMap((g) => g.items)
