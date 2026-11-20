import { X } from 'lucide-react'
import type { Tab } from './useTabs'

type Props = { tabs: Tab[]; route: string; onClose: (path: string) => void }

/** The pages opened so far, one tab each: tap a name to go back to that page, × to close it. */
export default function TabBar({ tabs, route, onClose }: Props) {
  if (tabs.length < 2) return null
  return (
    <nav className="tabbar" aria-label="الصفحات المفتوحة">
      {tabs.map((t) => {
        const active = t.path === route
        return (
          <div key={t.path} className={`tab-item ${active ? 'tab-active' : ''}`}>
            <a href={`#/${t.path}`} aria-current={active ? 'page' : undefined} title={t.label}>
              {t.label}
            </a>
            <button type="button" aria-label={`إغلاق ${t.label}`} onClick={() => onClose(t.path)}>
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </nav>
  )
}
