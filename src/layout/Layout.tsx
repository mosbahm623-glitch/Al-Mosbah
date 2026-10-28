import { useEffect, useState, type ReactNode } from 'react'
import { Bell, LogOut, Menu, Moon, Search, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { NAV } from './nav'
import { useRoute } from './route'
import { usePendingCount } from './usePendingCount'
import { startLive } from '../lib/live'
import { applyTheme, currentTheme, type Theme } from './theme'

const DESKTOP = '(min-width: 900px)'
const KEY = 'mosbah-sidebar'

function initialOpen(): boolean {
  if (!window.matchMedia(DESKTOP).matches) return false
  try {
    return localStorage.getItem(KEY) !== 'closed'
  } catch {
    return true
  }
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut, can } = useAuth()
  const pending = usePendingCount(profile?.role === 'admin')
  const route = useRoute()
  const [open, setOpen] = useState(initialOpen)
  const [theme, setTheme] = useState<Theme>(currentTheme)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => startLive(), [])

  function toggleSidebar() {
    const next = !open
    setOpen(next)
    if (window.matchMedia(DESKTOP).matches) {
      try {
        localStorage.setItem(KEY, next ? 'open' : 'closed')
      } catch {
        /* ignore */
      }
    }
  }

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    setTheme(next)
  }

  function onNavigate() {
    if (!window.matchMedia(DESKTOP).matches) setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !window.matchMedia(DESKTOP).matches) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <div className={`app ${open ? 'is-open' : 'is-closed'}`}>
      <header className="topbar">
        <button
          className="top-btn"
          onClick={toggleSidebar}
          aria-label={open ? 'إخفاء القائمة' : 'إظهار القائمة'}
          aria-expanded={open}
          aria-controls="sidebar"
        >
          <Menu size={22} />
        </button>
        <a className="brandmark" href="#/dashboard">
          <span className="logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18h6 M10 21h4 M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
            </svg>
          </span>
          <span className="brandname">المصباح</span>
        </a>

        <form
          className="top-search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault()
            const q = new FormData(e.currentTarget).get('q')?.toString().trim() ?? ''
            window.location.hash = `#/search${q ? `?q=${encodeURIComponent(q)}` : ''}`
          }}
        >
          <Search size={18} aria-hidden="true" />
          <input name="q" type="search" placeholder="بحث برقم القيد أو اسم المشروع" aria-label="بحث" />
        </form>

        <div className="top-actions">
          <a className="top-btn search-link" href="#/search" aria-label="بحث">
            <Search size={20} />
          </a>
          <button
            className="top-btn"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'التبديل للوضع الفاتح' : 'التبديل للوضع الداكن'}
            title={theme === 'dark' ? 'وضع فاتح' : 'وضع داكن'}
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <a className="top-btn" href="#/notifications" aria-label="الإشعارات">
            <Bell size={20} />
          </a>
          <div className="user">
            <span className="avatar" aria-hidden="true">
              {(profile?.full_name ?? 'م').trim().charAt(0)}
            </span>
            <span className="user-text">
              <span>{profile?.full_name ?? 'مستخدم'}</span>
              <span className="user-role">{isAdmin ? 'أدمن' : 'مستخدم'}</span>
            </span>
          </div>
          <button className="top-btn" onClick={() => void signOut()} aria-label="تسجيل الخروج" title="تسجيل الخروج">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <aside id="sidebar" className="sidebar" aria-label="القائمة الرئيسية" inert={!open}>
        <nav className="sidebar-nav">
          {NAV.map((group, i) => {
            const items = group.items.filter((it) => (it.adminOnly ? isAdmin : !it.module || can(it.module)))
            if (items.length === 0) return null
            return (
              <div className="nav-group" key={i}>
                {group.title && <span className="nav-title">{group.title}</span>}
                {items.map(({ path, label, icon: Icon }) => {
                  const active = route === path || route.startsWith(`${path}/`)
                  return (
                  <a
                    key={path}
                    href={`#/${path}`}
                    className={`nav-link ${active ? 'nav-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    <Icon size={19} aria-hidden="true" />
                    <span>{label}</span>
                    {path === 'approvals' && pending > 0 && <span className="nav-badge" aria-label={`${pending} قيد مستني الموافقة`}>{pending}</span>}
                  </a>
                  )
                })}
              </div>
            )
          })}
        </nav>
      </aside>

      <main className="content">{children}</main>
    </div>
  )
}
