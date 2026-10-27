import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { NAV } from './nav'
import { useRoute } from './route'

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const route = useRoute()
  const [open, setOpen] = useState(false)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className="app">
      <header className="mobilebar">
        <button className="icon-btn" onClick={() => setOpen(true)} aria-label="فتح القائمة" aria-expanded={open}>
          <Menu size={22} />
        </button>
        <strong>المصباح</strong>
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`} aria-label="القائمة الرئيسية">
        <div className="sidebar-head">
          <strong className="brand">المصباح</strong>
          <button className="icon-btn only-mobile" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
            <X size={22} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV.map((group, i) => {
            const items = group.items.filter((it) => !it.adminOnly || isAdmin)
            if (items.length === 0) return null
            return (
              <div className="nav-group" key={i}>
                {group.title && <span className="nav-title">{group.title}</span>}
                {items.map(({ path, label, icon: Icon }) => (
                  <a
                    key={path}
                    href={`#/${path}`}
                    className={`nav-link ${route === path ? 'nav-active' : ''}`}
                    aria-current={route === path ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{label}</span>
                  </a>
                ))}
              </div>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <span>{profile?.full_name ?? 'مستخدم'}</span>
            <span className="muted small">{isAdmin ? 'أدمن' : 'مستخدم'}</span>
          </div>
          <button className="icon-btn" onClick={() => void signOut()} aria-label="تسجيل الخروج" title="تسجيل الخروج">
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  )
}
