import { lazy, type ComponentType } from 'react'

const Dashboard = lazy(() => import('../pages/Dashboard'))
const QuickEntry = lazy(() => import('../pages/QuickEntry'))
const Search = lazy(() => import('../pages/Search'))
const Notifications = lazy(() => import('../pages/Notifications'))
const Projects = lazy(() => import('../pages/projects/Projects'))
const ProjectDetail = lazy(() => import('../pages/projects/ProjectDetail'))
const ProjectReport = lazy(() => import('../pages/projects/ProjectReport'))
const Advances = lazy(() => import('../pages/advances/Advances'))
const AdvanceDetail = lazy(() => import('../pages/advances/AdvanceDetail'))
const AdvanceReport = lazy(() => import('../pages/advances/AdvanceReport'))
const Banks = lazy(() => import('../pages/banks/Banks'))
const BankDetail = lazy(() => import('../pages/banks/BankDetail'))
const Contractors = lazy(() => import('../pages/contractors/Contractors'))
const Approvals = lazy(() => import('../pages/approvals/Approvals'))
const Users = lazy(() => import('../pages/users/Users'))
const Reports = lazy(() => import('../pages/reports/Reports'))
const Recent = lazy(() => import('../pages/reports/Recent'))

type RouteDef = {
  /** hash path; `:id` stands for one UUID */
  path: string
  /** any signed-in, active user may open it (the section's access rule from nav.ts is skipped) */
  open?: boolean
  /** gets the `:id` of the path (an empty string when the path has none) */
  page: ComponentType<{ id: string }>
}

/**
 * Every page of the app in one table. Who may open a page is decided by the nav item of its first path
 * segment (see nav.ts), so adding a page means: one line here, and one nav item for a new section.
 */
const ROUTES: RouteDef[] = [
  { path: 'dashboard', page: Dashboard },
  { path: 'quick-entry', page: QuickEntry },
  { path: 'projects', page: Projects },
  { path: 'projects/:id', page: ProjectDetail },
  { path: 'projects/:id/report', page: ProjectReport },
  { path: 'advances', page: Advances },
  { path: 'advances/:id', page: AdvanceDetail },
  { path: 'advances/:id/report', page: AdvanceReport },
  { path: 'banks', page: Banks },
  { path: 'banks/:id', page: BankDetail },
  { path: 'contractors', page: Contractors },
  { path: 'approvals', page: Approvals },
  { path: 'users', page: Users },
  { path: 'reports', page: Reports },
  { path: 'reports/journal', page: Reports },
  { path: 'search', page: Search },
  { path: 'recent', page: Recent },
  { path: 'notifications', open: true, page: Notifications },
]

const UUID = '([0-9a-f-]{36})'
const COMPILED = ROUTES.map((def) => ({ def, pattern: new RegExp(`^${def.path.replace(':id', UUID)}$`) }))

/** The page for a hash route (without the leading `#/`), or null when there is none. */
export function matchRoute(route: string): { def: RouteDef; id: string } | null {
  for (const { def, pattern } of COMPILED) {
    const m = pattern.exec(route)
    if (m) return { def, id: m[1] ?? '' }
  }
  return null
}
