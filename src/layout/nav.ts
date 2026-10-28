import type { Module } from '../auth/permissions'
import {
  BookOpen,
  Bell,
  CheckSquare,
  CreditCard,
  FileBarChart,
  HandCoins,
  History,
  Landmark,
  HardHat,
  LayoutDashboard,
  MessageCircle,
  FolderKanban,
  Search,
  Users,
  type LucideIcon,
} from 'lucide-react'

type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
  /** visible only to users who were granted this page */
  module?: Module
}

type NavGroup = { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    items: [
      { path: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, module: 'dashboard' },
      { path: 'projects', label: 'المشاريع', icon: FolderKanban, module: 'projects' },
      { path: 'advances', label: 'العهد', icon: HandCoins, module: 'advances' },
      { path: 'banks', label: 'البنوك', icon: Landmark, module: 'banks' },
      { path: 'contractors', label: 'مستحقات المقاولين', icon: HardHat, module: 'contractors' },
      { path: 'approvals', label: 'الموافقات', icon: CheckSquare, adminOnly: true },
      { path: 'users', label: 'المستخدمين', icon: Users, adminOnly: true },
      { path: 'reports', label: 'التقارير والتصدير', icon: FileBarChart, module: 'reports' },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { path: 'search', label: 'بحث برقم القيد', icon: Search, module: 'tools' },
      { path: 'journal', label: 'اليومية', icon: BookOpen, module: 'tools' },
      { path: 'recent', label: 'آخر التحركات', icon: History, module: 'tools' },
      { path: 'my-payments', label: 'دفعاتي', icon: CreditCard, module: 'tools' },
      { path: 'notifications', label: 'إشعارات', icon: Bell, module: 'tools' },
      { path: 'whatsapp', label: 'إرسال واتساب', icon: MessageCircle, module: 'tools' },
    ],
  },
]

export const ALL_ITEMS = NAV.flatMap((g) => g.items)
