import {
  BookOpen,
  Bell,
  CheckSquare,
  CreditCard,
  FileBarChart,
  HandCoins,
  HardHat,
  LayoutDashboard,
  MessageCircle,
  FolderKanban,
  Search,
  type LucideIcon,
} from 'lucide-react'

export type NavItem = {
  path: string
  label: string
  icon: LucideIcon
  adminOnly?: boolean
}

export type NavGroup = { title?: string; items: NavItem[] }

export const NAV: NavGroup[] = [
  {
    items: [
      { path: 'dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
      { path: 'projects', label: 'المشاريع', icon: FolderKanban },
      { path: 'advances', label: 'العهد', icon: HandCoins },
      { path: 'contractors', label: 'مستحقات المقاولين', icon: HardHat },
      { path: 'approvals', label: 'الموافقات', icon: CheckSquare, adminOnly: true },
      { path: 'reports', label: 'التقارير والتصدير', icon: FileBarChart },
    ],
  },
  {
    title: 'أدوات',
    items: [
      { path: 'search', label: 'بحث برقم القيد', icon: Search },
      { path: 'journal', label: 'Booking Journal', icon: BookOpen },
      { path: 'my-payments', label: 'دفعاتي', icon: CreditCard },
      { path: 'notifications', label: 'إشعارات', icon: Bell },
      { path: 'whatsapp', label: 'إرسال واتساب', icon: MessageCircle },
    ],
  },
]

export const ALL_ITEMS = NAV.flatMap((g) => g.items)
